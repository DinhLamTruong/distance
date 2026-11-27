/**
 * Module tìm kiếm tọa độ (Geocoding) và tính tuyến đường bộ (OSRM Routing)
 */
(function(window) {
  'use strict';

  const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
  const geocodeCache = new Map();
  const originCache = new Map();

  async function fetchJsonWithTimeout(url, options = {}, timeoutMs = 12000) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(url, { ...options, signal: controller.signal });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      return await res.json();
    } catch (e) {
      if (e.name === 'AbortError') throw new Error('Dịch vụ bản đồ phản hồi quá lâu (timeout)');
      throw e;
    } finally {
      clearTimeout(timer);
    }
  }

  const norm = t =>
    String(t || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/đ/gi, 'd')
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();

  function parseAddr(addr) {
    const parts = addr.split(',').map(x => x.trim()).filter(Boolean);
    const first = parts[0] || '';
    const m = first.match(/^([\d\/\-]+[A-Za-z]?)\s+(.+)$/);
    const noNum = (m ? m[2] : first).trim();
    const street = noNum
      .replace(/^(hẻm|ngõ|ngách|kiệt)\s+/i, '')
      .replace(/^(đường|đ\.|d\.)\s*/i, '');
    const admin = parts
      .slice(1)
      .map(x =>
        norm(x).replace(/^(phuong|quan|huyen|thanh pho|xa|tinh|tx|tp|p|q)\s+/, '')
      )
      .filter(x => x && !/^\d+$/.test(x) && !/ho chi minh|viet nam/.test(x));

    return { parts, noNum, street, streetKey: norm(street), admin };
  }

  function matchRoad(road, key) {
    const r = norm(road);
    return !!key && !!r && (
      r === key ||
      r.replace(/^(duong|hem|ngo|ngach|kiet|pho)\s+/, '') === key ||
      r.endsWith(' ' + key)
    );
  }

  async function searchAll(q, near) {
    const out = [];
    const errors = [];
    let answered = false;

    // 1. Nominatim OpenStreetMap
    try {
      let u = 'https://nominatim.openstreetmap.org/search?format=jsonv2&limit=8&addressdetails=1&countrycodes=vn&q=' + encodeURIComponent(q);
      if (near) {
        u += `&viewbox=${near.lon - 0.4},${near.lat + 0.4},${near.lon + 0.4},${near.lat - 0.4}`;
      }
      const data = await fetchJsonWithTimeout(u);
      answered = true;
      data.forEach(n => {
        out.push({
          lat: +n.lat,
          lon: +n.lon,
          label: n.display_name,
          road: n.address?.road || n.address?.pedestrian || n.name || '',
          text: norm(n.display_name)
        });
      });
    } catch (e) {
      errors.push('Nominatim: ' + e.message);
    }

    // 2. Photon Komoot
    try {
      const c = near || { lat: 10.78, lon: 106.70 };
      const u = `https://photon.komoot.io/api/?limit=8&lat=${c.lat}&lon=${c.lon}&q=` + encodeURIComponent(q);
      const data = await fetchJsonWithTimeout(u);
      answered = true;
      (data.features || []).forEach(f => {
        const pr = f.properties || {};
        const [lon, lat] = f.geometry?.coordinates || [];
        if (lat == null) return;
        out.push({
          lat: +lat,
          lon: +lon,
          label: [pr.name, pr.street, pr.district, pr.city, pr.state].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(', '),
          road: pr.street || pr.name || '',
          text: norm(Object.values(pr).filter(v => typeof v === 'string').join(' '))
        });
      });
    } catch (e) {
      errors.push('Photon: ' + e.message);
    }

    if (!answered) {
      throw new Error('Không kết nối được dịch vụ tìm địa chỉ. ' + errors.join(' | '));
    }

    return near
      ? out.filter(c => Math.abs(c.lat - near.lat) < 0.45 && Math.abs(c.lon - near.lon) < 0.45)
      : out;
  }

  /**
   * Định vị thông minh có so khớp tên đường và cấp hành chính
   */
  async function geocodeSmart(addr, near, allowUnverified = false) {
    const cacheKey = `${addr.toLowerCase().trim()}_${near ? `${near.lat.toFixed(2)},${near.lon.toFixed(2)}` : 'none'}`;
    if (geocodeCache.has(cacheKey)) {
      return geocodeCache.get(cacheKey);
    }

    const pa = parseAddr(addr);
    const rest = pa.parts.slice(1);
    const list = [addr, [pa.noNum, ...rest].join(', ')];
    if (rest.length >= 2) list.push([pa.noNum, ...rest.slice(-2)].join(', '));
    list.push([pa.noNum, rest[rest.length - 1] || 'Hồ Chí Minh'].join(', '));

    const seen = new Set();
    const queries = list
      .filter(q => q && !seen.has(q.toLowerCase()) && seen.add(q.toLowerCase()))
      .map(q => q + (/việt nam/i.test(q) ? '' : ', Việt Nam'));

    let best = null;
    let firstRaw = null;
    let answered = false;
    let lastErr = null;

    for (const q of queries) {
      try {
        const cands = await searchAll(q, near);
        answered = true;
        if (!firstRaw && cands[0]) firstRaw = cands[0];

        const valid = cands.filter(c => matchRoad(c.road, pa.streetKey));
        valid.forEach(c => {
          c.hits = pa.admin.filter(t => c.text.includes(t)).length;
        });
        valid.sort((x, y) => y.hits - x.hits);

        const c = valid[0];
        if (c) {
          if (c.hits > 0 || !pa.admin.length) {
            geocodeCache.set(cacheKey, c);
            return c;
          }
          if (!best) best = c;
        }
      } catch (e) {
        lastErr = e;
      }
      await sleep(950);
    }

    if (best) {
      const res = { ...best, uncertain: true };
      geocodeCache.set(cacheKey, res);
      return res;
    }
    if (allowUnverified && firstRaw) {
      const res = { ...firstRaw, uncertain: true };
      geocodeCache.set(cacheKey, res);
      return res;
    }

    if (!answered && lastErr) throw lastErr;
    return null;
  }

  /**
   * Tính tuyến đường bộ bằng OSRM
   */
  async function routeTo(from, to) {
    const url = `https://router.project-osrm.org/route/v1/driving/${from.lon},${from.lat};${to.lon},${to.lat}?overview=false`;
    const data = await fetchJsonWithTimeout(url, {}, 15000);
    if (data.code !== 'Ok' || !data.routes?.length) return null;
    return {
      km: data.routes[0].distance / 1000,
      minutes: data.routes[0].duration / 60
    };
  }

  /**
   * Tìm tọa độ điểm xuất phát
   */
  async function getOriginPoint(originAddress) {
    const text = (originAddress || '').trim();
    if (!text) throw new Error('Chưa nhập địa chỉ xuất phát.');
    if (!originCache.has(text)) {
      const pt = await geocodeSmart(text, null, true);
      if (!pt) {
        throw new Error('Không tìm thấy tọa độ địa chỉ xuất phát. Hãy nhập rõ thêm phường/quận/thành phố.');
      }
      originCache.set(text, pt);
    }
    return originCache.get(text);
  }

  /**
   * Ước tính khoảng cách từ điểm xuất phát đến 1 đơn hàng
   */
  async function estimateOrder(orderItem, originPoint) {
    try {
      const pt = await geocodeSmart(orderItem.address, originPoint, false);
      if (!pt) {
        orderItem.estimateError = 'Không xác định chắc chắn vị trí (bản đồ chưa có đúng tên đường/phường này). Bạn có thể chỉnh lại địa chỉ hoặc mở Google Maps rồi tự nhập km.';
        return;
      }
      orderItem.point = pt;
      orderItem.uncertain = !!pt.uncertain;

      const route = await routeTo(originPoint, pt);
      if (route) {
        orderItem.km = route.km;
        orderItem.minutes = route.minutes;
      } else {
        orderItem.estimateError = 'Không tìm thấy tuyến đường bộ phù hợp';
      }
    } catch (e) {
      orderItem.estimateError = e.message;
    }
  }

  window.BeeGeocode = {
    getOriginPoint,
    estimateOrder,
    geocodeSmart,
    routeTo
  };
})(window);
