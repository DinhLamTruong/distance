/**
 * Module xử lý OCR (Tesseract.js) và nhận diện đơn hàng / địa chỉ / giá tiền
 */
(function(window) {
  'use strict';

  let cachedWorkerPromise = null;

  /**
   * Tải thư viện Tesseract.js (ưu tiên local libs, fallback sang CDN)
   */
  async function loadTesseractLibrary() {
    if (window.Tesseract) return window.Tesseract;
    const sources = [
      './libs/tesseract.min.js',
      'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/tesseract.min.js',
      'https://unpkg.com/tesseract.js@5.1.1/dist/tesseract.min.js'
    ];

    let lastError = null;
    for (const src of sources) {
      try {
        await new Promise((resolve, reject) => {
          const script = document.createElement('script');
          const timer = setTimeout(() => {
            script.remove();
            reject(new Error('Hết thời gian tải từ ' + src));
          }, 8000);
          script.src = src;
          script.async = true;
          script.onload = () => {
            clearTimeout(timer);
            resolve();
          };
          script.onerror = () => {
            clearTimeout(timer);
            script.remove();
            reject(new Error('Không tải được: ' + src));
          };
          document.head.appendChild(script);
        });
        if (window.Tesseract) return window.Tesseract;
      } catch (err) {
        lastError = err;
      }
    }
    throw lastError || new Error('Không thể tải thư viện Tesseract.js.');
  }

  /**
   * Khởi tạo worker OCR một lần và tái sử dụng (giúp scan nhanh vượt trội)
   */
  async function getOcrWorker(statusCallback) {
    if (cachedWorkerPromise) return cachedWorkerPromise;

    cachedWorkerPromise = (async () => {
      const OCR = await loadTesseractLibrary();
      const isHttp = window.location.protocol === 'http:' || window.location.protocol === 'https:';

      const logger = m => {
        if (typeof statusCallback === 'function') {
          const label = m.status || 'Đang xử lý';
          const pct = m.progress == null ? '' : ` (${Math.round(m.progress * 100)}%)`;
          statusCallback(`${label}${pct}`);
        }
      };

      // Cấu hình local offline trong D:\distance\libs
      const localConfig = {
        workerPath: './libs/worker.min.js',
        corePath: './libs/core',
        langPath: './libs/lang',
        gzip: true,
        cacheMethod: 'write',
        logger
      };

      // Cấu hình fallback CDN
      const cdnConfig = {
        workerPath: 'https://cdn.jsdelivr.net/npm/tesseract.js@5.1.1/dist/worker.min.js',
        corePath: 'https://cdn.jsdelivr.net/npm/tesseract.js-core@5.1.1',
        langPath: 'https://tessdata.projectnaptha.com/4.0.0',
        gzip: true,
        cacheMethod: 'write',
        logger
      };

      if (isHttp) {
        try {
          return await OCR.createWorker('vie', 1, localConfig);
        } catch (e) {
          console.warn('Worker local không khởi tạo được, chuyển sang CDN...', e);
        }
      }

      try {
        return await OCR.createWorker('vie', 1, cdnConfig);
      } catch (err) {
        try {
          return await OCR.createWorker('vie', 1, localConfig);
        } catch (err2) {
          cachedWorkerPromise = null;
          throw new Error('Lỗi khởi tạo bộ nhận diện OCR: ' + (err.message || err));
        }
      }
    })().catch(err => {
      cachedWorkerPromise = null;
      throw err;
    });

    return cachedWorkerPromise;
  }

  /**
   * Phóng ảnh chụp màn hình vừa đủ và giữ nguyên màu/nét gốc để không làm mất dấu tiếng Việt.
   */
  function prepareOcrImage(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      const url = URL.createObjectURL(file);

      img.onload = () => {
        try {
          const pixelBudget = 14000000;
          const scale = Math.min(
            2,
            Math.sqrt(pixelBudget / (img.width * img.height))
          );

          const canvas = document.createElement('canvas');
          canvas.width = Math.round(img.width * scale);
          canvas.height = Math.round(img.height * scale);

          const ctx = canvas.getContext('2d', { willReadFrequently: true });
          ctx.imageSmoothingEnabled = true;
          ctx.imageSmoothingQuality = 'high';
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

          URL.revokeObjectURL(url);
          resolve(canvas);
        } catch (err) {
          URL.revokeObjectURL(url);
          reject(err);
        }
      };

      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('Không thể tải hoặc giải mã tệp ảnh đã chọn.'));
      };

      img.src = url;
    });
  }

  /**
   * Trích xuất giá tiền từ chuỗi văn bản
   */
  function parseFareText(text, requireCurrency = false) {
    if (!text) return null;
    const cleaned = String(text)
      .replace(/[OoQ]/g, '0')
      .replace(/[óòọôơ]/gi, '6')
      .replace(/[Il|]/g, '1')
      .replace(/S/g, '5');

    const source = requireCurrency
      ? cleaned.replace(/(\d)\s*(?:đ|đồng|vnd|d)\b/ig, '$1đ')
      : cleaned;

    const pattern = requireCurrency
      ? /(?:^|[^\d])((?:\d{1,3}(?:[.,\s]\d{3})+)|\d{4,7})\s*đ(?=$|[^a-z])/ig
      : /(?:^|[^\d])((?:\d{1,3}(?:[.,\s]\d{3})+)|\d{4,7})(?=$|[^\d])/g;

    const matches = [...source.matchAll(pattern)];
    if (!matches.length) return null;

    const values = matches
      .map(m => Number(m[1].replace(/[.,\s]/g, '')))
      .filter(n => Number.isFinite(n) && n >= 1000 && n <= 10000000);

    if (!values.length) return null;
    return values.sort((a, b) => String(b).length - String(a).length || b - a)[0] ?? null;
  }

  function parseFareRange(text) {
    if (!text) return null;
    const cleaned = String(text)
      .replace(/[OoQ]/g, '0')
      .replace(/[óòọôơ]/gi, '6')
      .replace(/[Il|]/g, '1')
      .replace(/S/g, '5')
      .replace(/(\d)\s*(?:đ|đồng|vnd|d)\b/ig, '$1đ');
    const amounts = [...cleaned.matchAll(/(?:^|[^\d])((?:\d{1,3}(?:[.,\s]\d{3})+)|\d{4,7})\s*đ(?=$|[^a-z])/ig)]
      .map(match => Number(match[1].replace(/[.,\s]/g, '')))
      .filter(amount => Number.isFinite(amount) && amount >= 1000 && amount <= 10000000);

    if (amounts.length < 2 || !/đ\s*[-–—]\s*[\dOoQóòọôơIl|]/i.test(cleaned)) return null;
    return {
      min: Math.min(amounts[0], amounts[1]),
      max: Math.max(amounts[0], amounts[1])
    };
  }

  function normalizeLine(s) {
    return String(s || '').replace(/^[\s•·\-–—|¦]+/, '').replace(/\s+/g, ' ').trim();
  }

  function cleanOcrAddressFragment(text) {
    let line = normalizeLine(text);
    const isTruncated = /(?:\.{2,}|…)\s*$/.test(line);
    line = line
      .replace(/(?:\.{2,}|…)\s*$/, '')
      .replace(/^o\s+(?=cổng\s+chính\b)/iu, '')
      .replace(/^l\s*-\s*(?=điểm\s+đón\s+trả)/iu, '')
      .replace(/^l\s*-\s*(?=(?:[óòọôơo0]\s*)?\/\s*\d)/iu, '')
      .replace(/^[=~<>^]{1,2}\s*(?=2\s+(?:phẩm|trường\s+sơn)\b)/iu, '')
      .replace(/^(?:[ọỌ]|[©®]|[&@][\p{L}\d>?]*|s\s*=|[\p{L}]{1,2}(?=\s+\d))\s*/iu, '')
      .replace(/^[\p{L}\d]{1,2}[©®=~<>^]+\s+(?=(?:p\.?|q\.?|phường|quận|xã|thành|hồ)\b)/iu, '')
      .replace(/(^|\s)[©®=~<>^]{1,3}(?=\s|$)/gu, '$1')
      .replace(/^(?:[o0]\s*)?[óòọôơ](?=\s*\/\s*\d)/iu, '6')
      .replace(/^(\d)ó(?=\s)/iu, (_, digit) => `${digit}6`)
      .replace(/^(?:[©®]\s*)?\d{1,2}\s+(?=chí\s+minh\b)/iu, '')
      .replace(/\bS\?\s+(?=Ông\s+Lãnh\b)/iu, '')
      .replace(/(^|[\s,])Hồ\s+\d{1,2}\s+(?=Chí\s+Minh\b)/iu, '$1Hồ ')
      .replace(/\b36[óòọôơ](?:[óòọôơ6])?(?=\s+phan\s+văn\s+trị(?:\s|[,.;]|$))/iu, '366')
      .replace(/^[^\p{L}\p{N}]{0,3}(?:[\p{L}\p{N}]{1,3}[\p{P}\p{S}]*)?\s+(?=(?:thành\s+phố|tp\.?|hồ\s+chí\s+minh|ho\s+chi\s+minh)(?:\s|$|[,.;]))/iu, '')
      .trim();
    return isTruncated && line ? `${line}…` : line;
  }

  function fixKnownOcrAddressArtifacts(address) {
    return address
      .replace(/\bthực\s+2\s+phẩm\b/giu, 'Thực Phẩm')
      .replace(/\b(28)\s+2\s+(?=trường\s+sơn\b)/giu, '$1 ')
      .replace(/cầu\s*[=~<>^?]+\s*(?=ông\s+lãnh)/giu, 'Cầu ')
      .replace(/(^|[\s,])Hồ\s*[=~<>^?]*\s*\d{1,2}\s+(?=Chí\s+Minh\b)/giu, '$1Hồ ');
  }

  function normalizeServiceText(text) {
    return String(text || '')
      .normalize('NFD')
      .replace(/\p{Diacritic}/gu, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^\p{L}\d]+/gu, ' ')
      .trim();
  }

  function getServiceType(text) {
    const service = normalizeServiceText(text);
    if (/^giao hang(?: sieu toc)?$/.test(service)) return 'Giao hàng Siêu tốc';
    if (/^be\s*bike$/.test(service)) return 'beBike';
    if (/^be\s*car$/.test(service)) return 'beCar';
    if (/^be\s*delivery$/.test(service)) return 'beDelivery';
    if (/^be\s*food$/.test(service)) return 'beFood';
    return null;
  }

  function isSupportedService(text) {
    const normalized = normalizeServiceText(text);
    return /(?:^|\s)(?:be\s*(?:bike|car|delivery|food)|giao\s+hang(?:\s+sieu\s+toc)?)(?=$|\s)/.test(normalized);
  }

  /**
   * Kiểm tra xem một dòng có phải là Header mở đầu một đơn hàng hay không:
   * - Có giờ hẹn: 04:35, 24/11
   * - HOẶC có giờ kèm giá tiền / beBike
   * - KHÔNG phải là đồng hồ thanh trạng thái ở mép trên cùng của điện thoại
   */
  function isOrderHeader(line, nextLines, imgHeight) {
    const text = normalizeLine(line.text || '');
    if (!text) return false;

    // Loại bỏ đồng hồ thanh trạng thái hệ thống (y nằm trong 7% trên cùng của ảnh)
    if (line.bbox && imgHeight && (line.bbox.y0 / imgHeight) < 0.08) {
      return false;
    }

    // Khớp dạng giờ kèm ngày: "04:35, 24/11" hoặc "07:00, 24/11"
    const timeWithDate = /\b\d{1,2}:\d{2}\s*,\s*\d{1,2}\/\d{1,2}\b/;
    if (timeWithDate.test(text)) return true;

    // Chấp nhận mọi loại dịch vụ hỗ trợ, kể cả Giao hàng Siêu tốc.
    const pureTime = /\b\d{1,2}:\d{2}\b/;
    if (pureTime.test(text)) {
      const peek = [text, ...nextLines.map(l => l.text || '')].join(' ');
      if (isSupportedService(peek) && parseFareText(peek, true) !== null) {
        return true;
      }
    }

    return false;
  }

  /**
   * Trích xuất danh sách đơn hàng (địa chỉ điểm đón, điểm đến và giá cước) từ dữ liệu OCR
   */
  async function extractOrders(ocrData, preparedCanvas, worker) {
    const canvasH = preparedCanvas?.height || 1000;
    const rawLines = (ocrData.lines || [])
      .map(x => ({
        text: normalizeLine(x.text || ''),
        y: x.bbox?.y0 ?? 0,
        bbox: x.bbox || null
      }))
      .filter(x => x.text)
      .sort((a, b) => a.y - b.y);

    // Tìm các mốc giờ mở đầu mỗi đơn
    const headerIndices = [];
    rawLines.forEach((line, i) => {
      const nextLines = rawLines.slice(i + 1, i + 4);
      if (isOrderHeader(line, nextLines, canvasH)) {
        headerIndices.push(i);
      }
    });

    // Gom nhóm các dòng theo từng thẻ đơn hàng
    const groups = headerIndices.length
      ? headerIndices.map((idx, n) => ({
          lines: rawLines.slice(idx, headerIndices[n + 1] ?? rawLines.length),
          header: rawLines[idx]
        }))
      : [{ lines: rawLines, header: null }];

    const orders = [];
    const fixer = window.AddressFixer || { cleanAndFixAddress: a => a };

    for (const item of groups) {
      const groupLines = item.lines;
      const joined = groupLines.map(x => x.text).join(' ');

      // 1. Lấy giá tiền
      const fare = parseFareText(joined, true);
      const serviceType = groupLines.map(x => getServiceType(x.text)).find(Boolean) || null;

      // 2. Lấy các dòng nội dung địa chỉ (loại bỏ dòng giờ, ngày, giá, beBike)
      const contentLines = groupLines
        .map(x => ({
          text: cleanOcrAddressFragment(x.text),
          isDropoffMarker: /^ọ(?:\s|$)/i.test(x.text)
        }))
        .filter(text => {
          const s = text.text.trim();
          if (!s) return false;
          if (/\b\d{1,2}:\d{2}\b/.test(s)) return false;
          if (/\d{1,3}[.,]\d{3}\s*đ/i.test(s)) return false;
          if (getServiceType(s)) return false;
          if (/^(?:hôm\s*nay|chuyến\s*đang\s*có|chuyến\s*đã\s*nhận)/i.test(s)) return false;
          return true;
        });

      if (!contentLines.length) continue;

      // 3. Tách Điểm đón (Pickup) và Điểm đến (Dropoff)
      // Trong app Bee: Điểm đón (chấm xanh) luôn nằm trước, Điểm đến (chấm đỏ) nằm sau
      let pickupParts = [];
      let dropoffParts = [];
      let current = pickupParts;

      for (let i = 0; i < contentLines.length; i++) {
        const entry = contentLines[i];
        const line = entry.text.trim();
        if (entry.isDropoffMarker && current === pickupParts && pickupParts.length) {
          current = dropoffParts;
        }
        current.push(line);

        // Điểm đón kết thúc khi gặp Hồ Chí Minh / Thành Phố / Thủ Đức
        const isEndOfPickup = /(hồ\s*chí\s*minh|ho\s*chi\s*minh|thành\s*phố|thanh\s*pho|tp\.?|tỉnh|hcm)$/i.test(line.replace(/[,.-]+$/, ''));
        const nextLine = contentLines[i + 1]?.text.trim() || '';
        const splitCityName = /hồ$/i.test(line.replace(/[,.-]+$/, '')) && /^chí\s+minh\b/i.test(nextLine);
        if (splitCityName && current === pickupParts) {
          pickupParts.push(nextLine);
          i++;
        }
        if ((isEndOfPickup || splitCityName) && current === pickupParts && i < contentLines.length - 1) {
          current = dropoffParts;
        }
      }

      const rawPickup = fixKnownOcrAddressArtifacts(
        pickupParts.join(' ').replace(/\s*,\s*/g, ', ').trim()
      );
      const rawDropoff = fixKnownOcrAddressArtifacts(
        dropoffParts.join(' ').replace(/\s*,\s*/g, ', ').trim()
      );

      // Chuẩn hóa chính tả điểm đón (địa chỉ chính để tài xế di chuyển)
      const cleanedPickup = fixer.cleanAndFixAddress(rawPickup);
      const cleanedDropoff = fixer.cleanAndFixAddress(rawDropoff);

      if (cleanedPickup && cleanedPickup.length >= 6) {
        if (!orders.some(o => o.address.toLowerCase() === cleanedPickup.toLowerCase())) {
          const fareRange = parseFareRange(joined);
          orders.push({
            address: cleanedPickup,
            dropoff: cleanedDropoff || null,
            serviceType,
            fare: fareRange?.max ?? fare,
            fareMin: fareRange?.min ?? null,
            fareMax: fareRange?.max ?? null
          });
        }
      }
    }

    return orders;
  }

  window.BeeOcr = {
    loadTesseractLibrary,
    getOcrWorker,
    prepareOcrImage,
    extractOrders,
    parseFareText,
    parseFareRange
  };
})(window);
