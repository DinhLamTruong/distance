/**
 * Module điều phối ứng dụng chính (UI & Interactions) cho Bee Distance
 */
(() => {
  'use strict';

  const $ = id => document.getElementById(id);
  const STORAGE_KEY = 'bee-distance-history-v1';

  let imageFile = null;
  let addresses = [];
  let orderFares = {};
  let orderFareRanges = {};
  let orderDropoffs = {};
  let results = [];

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    }[c]));
  }

  function setStatus(id, text, type = '') {
    const el = $(id);
    if (!el) return;
    el.textContent = text;
    el.className = 'status' + (type ? ' ' + type : '');
  }

  function originValue() {
    return $('originAddress')?.value.trim() || '';
  }

  function hasOrigin() {
    return !!originValue();
  }

  function renderAddresses() {
    const root = $('addresses');
    if (!addresses.length) {
      root.innerHTML = '<div class="muted">Chưa có địa chỉ. Hãy chọn ảnh để bắt đầu hoặc bấm "+ Thêm địa chỉ".</div>';
      $('routeBtn').disabled = true;
      return;
    }

    root.innerHTML = '';
    addresses.forEach((addr, i) => {
      const div = document.createElement('div');
      div.className = 'address-item';
      const fare = orderFares[addr];
      const fareRange = orderFareRanges[addr];
      const dropoff = orderDropoffs[addr];

      div.innerHTML = `
        <div>
          <div style="font-size:12px;font-weight:700;color:#0b4a99;margin-bottom:4px">Đơn #${i + 1} — Điểm đón khách:</div>
          <input type="text" aria-label="Địa chỉ đón ${i + 1}" value="${escapeHtml(addr)}" data-index="${i}">
          ${dropoff ? `<div class="muted" style="margin-top:4px;font-size:12px;color:#475467">🚩 <b>Điểm đến:</b> ${escapeHtml(dropoff)}</div>` : ''}
          <small>
            Giá cước: 
            <input type="number" min="0" step="1000" data-fare="${i}" value="${fare ?? ''}" placeholder="đồng" style="width:120px;padding:5px 8px;border:1px solid #d0d5dd;border-radius:6px"> đ
          </small>
          ${fareRange ? `<div class="muted">OCR nhận dạng khoảng ${Number(fareRange.min).toLocaleString('vi-VN')}–${Number(fareRange.max).toLocaleString('vi-VN')} đ</div>` : ''}
        </div>
        <div class="address-actions">
          <button class="secondary" data-up="${i}" title="Chuyển lên">↑</button>
          <button class="secondary" data-down="${i}" title="Chuyển xuống">↓</button>
          <button class="secondary danger" data-delete="${i}" title="Xóa">✕</button>
        </div>
      `;
      root.appendChild(div);
    });

    // Event listeners
    root.querySelectorAll('input[data-index]').forEach(inp => {
      inp.addEventListener('change', e => {
        const i = +e.target.dataset.index;
        const oldAddr = addresses[i];
        const newAddr = e.target.value.trim();
        addresses[i] = newAddr;
        if (oldAddr !== newAddr) {
          if (orderFares[oldAddr] !== undefined) {
            orderFares[newAddr] = orderFares[oldAddr];
            delete orderFares[oldAddr];
          }
          if (orderFareRanges[oldAddr] !== undefined) {
            orderFareRanges[newAddr] = orderFareRanges[oldAddr];
            delete orderFareRanges[oldAddr];
          }
          if (orderDropoffs[oldAddr] !== undefined) {
            orderDropoffs[newAddr] = orderDropoffs[oldAddr];
            delete orderDropoffs[oldAddr];
          }
        }
      });
    });

    root.querySelectorAll('input[data-fare]').forEach(inp => {
      inp.addEventListener('change', e => {
        const v = parseFloat(e.target.value);
        const idx = +e.target.dataset.fare;
        orderFares[addresses[idx]] = isNaN(v) ? null : v;
        delete orderFareRanges[addresses[idx]];
        renderAddresses();
      });
    });

    root.querySelectorAll('[data-delete]').forEach(btn => {
      btn.addEventListener('click', () => {
        const idx = +btn.dataset.delete;
        const addr = addresses[idx];
        delete orderFares[addr];
        delete orderFareRanges[addr];
        delete orderDropoffs[addr];
        addresses.splice(idx, 1);
        renderAddresses();
      });
    });

    root.querySelectorAll('[data-up]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.up;
        if (i > 0) {
          [addresses[i - 1], addresses[i]] = [addresses[i], addresses[i - 1]];
          renderAddresses();
        }
      });
    });

    root.querySelectorAll('[data-down]').forEach(btn => {
      btn.addEventListener('click', () => {
        const i = +btn.dataset.down;
        if (i < addresses.length - 1) {
          [addresses[i + 1], addresses[i]] = [addresses[i], addresses[i + 1]];
          renderAddresses();
        }
      });
    });

    $('routeBtn').disabled = !hasOrigin() || !addresses.some(x => x.trim());
  }

  // Chọn ảnh
  $('imageInput')?.addEventListener('change', e => {
    imageFile = e.target.files[0] || null;
    $('ocrBtn').disabled = !imageFile;
    if (imageFile) {
      const url = URL.createObjectURL(imageFile);
      $('preview').src = url;
      $('preview').hidden = false;
      setStatus('ocrStatus', `Đã chọn: ${imageFile.name} (${Math.round(imageFile.size / 1024)} KB). Bấm “Đọc địa chỉ bằng OCR” để bắt đầu.`, 'ok');
    }
  });

  // Bấm nút Đọc OCR
  $('ocrBtn')?.addEventListener('click', async () => {
    if (!imageFile) return;
    $('ocrBtn').disabled = true;

    try {
      setStatus('ocrStatus', 'Đang nạp bộ nhận diện OCR...', 'loading');
      const worker = await window.BeeOcr.getOcrWorker(msg => {
        setStatus('ocrStatus', msg, 'loading');
      });

      setStatus('ocrStatus', 'Đang tối ưu độ phân giải ảnh...', 'loading');
      const preparedCanvas = await window.BeeOcr.prepareOcrImage(imageFile);

      setStatus('ocrStatus', 'Đang quét chữ và số trên ảnh...', 'loading');
      const startTime = performance.now();
      const { data } = await worker.recognize(preparedCanvas);
      const scanDuration = ((performance.now() - startTime) / 1000).toFixed(1);

      if ($('ocrRaw')) {
        $('ocrRaw').textContent = data.text || '(Không nhận diện được chữ nào)';
        $('ocrRawWrap').hidden = false;
      }

      setStatus('ocrStatus', 'Đang phân tách thẻ đơn hàng và chuẩn hóa chính tả địa chỉ...', 'loading');
      const foundOrders = await window.BeeOcr.extractOrders(data, preparedCanvas, worker);

      if (foundOrders.length) {
        let addedCount = 0;
        foundOrders.forEach(o => {
          if (!addresses.some(a => a.toLowerCase() === o.address.toLowerCase())) {
            addresses.push(o.address);
            orderFares[o.address] = o.fare;
            if (o.fareMin != null && o.fareMax != null) {
              orderFareRanges[o.address] = { min: o.fareMin, max: o.fareMax };
            }
            if (o.dropoff) orderDropoffs[o.address] = o.dropoff;
            addedCount++;
          }
        });

        renderAddresses();
        setStatus(
          'ocrStatus',
          `✅ Quét xong trong ${scanDuration}s! Tìm thấy chính xác ${foundOrders.length} đơn hàng (${addedCount} đơn mới). Điểm đón khách đã được chuẩn hóa đúng chính tả.`,
          'ok'
        );
      } else {
        setStatus(
          'ocrStatus',
          'OCR đã quét nhưng chưa nhận diện được địa chỉ phù hợp. Vui lòng bấm vào "Xem chữ OCR gốc" để kiểm tra.',
          'err'
        );
      }
    } catch (err) {
      console.error(err);
      setStatus('ocrStatus', 'Lỗi khi chạy OCR: ' + (err.message || err), 'err');
    } finally {
      $('ocrBtn').disabled = !imageFile;
    }
  });

  // Nút thêm địa chỉ thủ công
  $('addBtn')?.addEventListener('click', () => {
    addresses.push('');
    renderAddresses();
    const inputs = $('addresses').querySelectorAll('input[type="text"]');
    if (inputs.length) inputs[inputs.length - 1].focus();
  });

  // Nút xóa danh sách
  $('clearBtn')?.addEventListener('click', () => {
    if (addresses.length && !confirm('Bạn có chắc muốn xóa toàn bộ danh sách địa chỉ?')) return;
    addresses = [];
    orderFares = {};
    orderFareRanges = {};
    orderDropoffs = {};
    results = [];
    renderAddresses();
    renderResults();
    setStatus('routeStatus', 'Đã xóa danh sách địa chỉ.');
  });

  // Khi thay đổi địa chỉ xuất phát
  $('originAddress')?.addEventListener('input', () => {
    renderAddresses();
  });

  // Tính khoảng cách
  $('routeBtn')?.addEventListener('click', async () => {
    const fixer = window.AddressFixer;
    addresses = addresses.map(a => {
      const cleaned = fixer ? fixer.cleanAndFixAddress(a) : a.trim();
      if (cleaned !== a) {
        if (orderFares[a] !== undefined) {
          orderFares[cleaned] = orderFares[a];
          delete orderFares[a];
        }
        if (orderFareRanges[a] !== undefined) {
          orderFareRanges[cleaned] = orderFareRanges[a];
          delete orderFareRanges[a];
        }
        if (orderDropoffs[a] !== undefined) {
          orderDropoffs[cleaned] = orderDropoffs[a];
          delete orderDropoffs[a];
        }
      }
      return cleaned;
    });
    renderAddresses();

    const validList = addresses.map(x => x.trim()).filter(Boolean);
    if (!hasOrigin() || !validList.length) {
      setStatus('routeStatus', 'Cần nhập địa chỉ xuất phát và có ít nhất 1 địa chỉ đơn hàng.', 'err');
      return;
    }

    $('routeBtn').disabled = true;
    results = validList.map(address => ({
      address,
      dropoff: orderDropoffs[address] ?? null,
      fare: orderFares[address] ?? null,
      fareMin: orderFareRanges[address]?.min ?? null,
      fareMax: orderFareRanges[address]?.max ?? null,
      kmManual: null,
      km: null,
      minutes: null
    }));
    renderResults();

    let originPoint;
    try {
      setStatus('routeStatus', 'Đang định vị địa chỉ xuất phát...', 'loading');
      originPoint = await window.BeeGeocode.getOriginPoint(originValue());
    } catch (e) {
      setStatus('routeStatus', e.message, 'err');
      $('routeBtn').disabled = false;
      return;
    }

    for (let i = 0; i < results.length; i++) {
      setStatus('routeStatus', `Đang tính lộ trình đến điểm đón đơn ${i + 1}/${results.length}: ${results[i].address}`, 'loading');
      await window.BeeGeocode.estimateOrder(results[i], originPoint);
      renderResults();
      await new Promise(r => setTimeout(r, 600));
    }

    sortResults();
    renderResults();
    saveHistory();

    const badCount = results.filter(r => r.km == null && r.kmManual == null).length;
    if (badCount) {
      setStatus('routeStatus', `Hoàn tất! Có ${badCount} đơn chưa tự động tính được đường đi — bạn có thể bấm "Mở Google Maps" và tự điền số km.`, 'err');
    } else {
      setStatus('routeStatus', '✅ Đã tính xong khoảng cách đường bộ xe máy đến các điểm đón!', 'ok');
    }

    $('routeBtn').disabled = false;
  });

  function fmtTime(min) {
    if (min < 60) return `${Math.max(1, Math.round(min))} phút`;
    const h = Math.floor(min / 60);
    const m = Math.round(min % 60);
    return `${h} giờ${m ? ' ' + m + ' phút' : ''}`;
  }

  function mapsUrl(r) {
    return 'https://www.google.com/maps/dir/?api=1&origin=' +
      encodeURIComponent(originValue()) +
      '&destination=' + encodeURIComponent(r.address + ', Việt Nam') +
      '&travelmode=two-wheeler';
  }

  function effKm(r) {
    return r.kmManual != null ? r.kmManual : (r.km != null ? r.km : null);
  }

  function formatFare(r) {
    if (r.fareMin != null && r.fareMax != null && r.fareMin !== r.fareMax) {
      return `${Number(r.fareMin).toLocaleString('vi-VN')}–${Number(r.fareMax).toLocaleString('vi-VN')} đ`;
    }
    return r.fare != null ? `${Number(r.fare).toLocaleString('vi-VN')} đ` : '';
  }

  function sortResults() {
    const mode = $('sortMode')?.value || 'distance';
    const val = r => {
      const k = effKm(r);
      return (r.fare != null && k > 0) ? (r.fare / k) : -1;
    };

    if (mode === 'fare') {
      results.sort((a, b) => (b.fare ?? -1) - (a.fare ?? -1));
    } else if (mode === 'value') {
      results.sort((a, b) => val(b) - val(a));
    } else {
      results.sort((a, b) => (effKm(a) ?? Infinity) - (effKm(b) ?? Infinity));
    }
  }

  $('sortMode')?.addEventListener('change', () => {
    sortResults();
    renderResults();
  });

  function renderResults() {
    const root = $('results');
    if (!results.length) {
      root.innerHTML = '<div class="muted">Chưa có kết quả.</div>';
      $('mapsAllBtn').disabled = true;
      return;
    }

    root.innerHTML = '';
    results.forEach((r, i) => {
      const k = effKm(r);
      const div = document.createElement('div');
      div.className = 'result';

      const left = document.createElement('div');
      const right = document.createElement('div');

      left.innerHTML = `
        <h3>${i + 1}. 📍 Đón: ${escapeHtml(r.address)}</h3>
        ${r.dropoff ? `<div style="margin:3px 0 6px;color:#475467;font-size:13px">🚩 <b>Đến:</b> ${escapeHtml(r.dropoff)}</div>` : ''}
        ${r.point ? `<div class="muted">📍 Đã định vị: ${escapeHtml(r.point.label)}</div>` : ''}
        ${r.fare != null ? `<div style="margin-top:5px;font-weight:700;color:#b54708">💵 Giá cước: ${formatFare(r)}</div>` : ''}
        ${k > 0 && r.fare != null ? `<div class="muted">⭐ Đơn giá: ${r.fareMin != null && r.fareMax != null ? `${(r.fareMin / k).toLocaleString('vi-VN', { maximumFractionDigits: 0 })}–` : ''}${(r.fare / k).toLocaleString('vi-VN', { maximumFractionDigits: 0 })} đ/km</div>` : ''}
        ${r.estimateError ? `<div class="muted" style="color:#b42318;margin-top:6px">⚠️ ${escapeHtml(r.estimateError)}</div>` : ''}
        ${r.uncertain && r.km != null ? '<span class="pill">Cần đối chiếu thêm trên Google Maps</span>' : ''}
      `;

      right.innerHTML = `
        <div class="metric">${k != null ? k.toFixed(1) + ' km' : '— km'}</div>
        <div class="submetric">
          ${r.kmManual != null ? 'Tự nhập theo Google Maps' : (r.km != null ? fmtTime(r.minutes) + ' ước tính' : (r.estimateError ? 'Chưa xác định' : 'Đang tính...'))}
        </div>
        <div style="text-align:right;margin-top:10px">
          <button class="secondary" data-maps="${i}">Mở Google Maps</button>
        </div>
        <div style="text-align:right;margin-top:8px">
          <input type="number" step="0.1" min="0" placeholder="Km (Google)" value="${r.kmManual ?? ''}" data-manual="${i}" style="width:125px;padding:6px 8px;border:1px solid #d0d5dd;border-radius:6px">
        </div>
      `;

      right.querySelector('[data-maps]').addEventListener('click', () => {
        window.open(mapsUrl(r), '_blank', 'noopener');
      });

      right.querySelector('[data-manual]').addEventListener('change', e => {
        const v = parseFloat(String(e.target.value).replace(',', '.'));
        r.kmManual = isNaN(v) ? null : v;
        sortResults();
        renderResults();
        saveHistory();
      });

      div.append(left, right);
      root.appendChild(div);
    });

    $('mapsAllBtn').disabled = !results.length;
  }

  // Mở Maps điểm gần nhất
  $('mapsAllBtn')?.addEventListener('click', () => {
    const nearest = results[0];
    if (nearest) window.open(mapsUrl(nearest), '_blank', 'noopener');
  });

  // Quản lý lịch sử
  function getHistory() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    } catch {
      return [];
    }
  }

  function saveHistory() {
    const valid = results.filter(r => effKm(r) != null);
    if (!valid.length) return;
    const history = getHistory();
    history.unshift({
      date: new Date().toLocaleString('vi-VN'),
      origin: originValue(),
      items: valid.map(r => ({
        address: r.address,
        dropoff: r.dropoff ?? null,
        km: effKm(r),
        fare: r.fare ?? null,
        fareMin: r.fareMin ?? null,
        fareMax: r.fareMax ?? null,
        minutes: r.minutes ?? null
      }))
    });
    localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(0, 30)));
  }

  $('historyBtn')?.addEventListener('click', () => {
    const root = $('history');
    const h = getHistory();
    root.innerHTML = '<hr><h3 style="font-size:16px;margin:12px 0 8px">Lịch sử tra cứu gần đây</h3>';

    if (!h.length) {
      root.innerHTML += '<div class="muted">Chưa có lịch sử được lưu.</div>';
      return;
    }

    h.forEach(entry => {
      const box = document.createElement('div');
      box.className = 'status';
      box.style.marginBottom = '10px';
      box.innerHTML = `
        <b>🕒 ${escapeHtml(entry.date)}</b> · Xuất phát: <i>${escapeHtml(entry.origin)}</i><br>
        ${entry.items.map(x => `• <b>Đón:</b> ${escapeHtml(x.address)}${x.dropoff ? ` ➔ <b>Đến:</b> ${escapeHtml(x.dropoff)}` : ''} — <b>${x.km.toFixed(1)} km</b>${x.fare ? ` (${formatFare(x)})` : ''}${x.minutes != null ? ` (~${fmtTime(x.minutes)})` : ''}`).join('<br>')}
      `;
      root.appendChild(box);
    });
  });

  $('clearHistoryBtn')?.addEventListener('click', () => {
    if (confirm('Bạn có muốn xóa toàn bộ lịch sử Bee Distance trên thiết bị này?')) {
      localStorage.removeItem(STORAGE_KEY);
      $('history').innerHTML = '';
      alert('Đã xóa sạch lịch sử.');
    }
  });

  // Khởi động
  renderAddresses();
})();
