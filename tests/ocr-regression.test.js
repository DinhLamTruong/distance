const assert = require('node:assert/strict');
const test = require('node:test');

global.window = globalThis;
require('../js/address-fix.js');
require('../js/ocr.js');
require('../js/geocode.js');

function makeLines(texts) {
  return texts.map((text, index) => ({
    text,
    bbox: {
      x0: 100,
      y0: (index + 2) * 100,
      x1: 1400,
      y1: (index + 2) * 100 + 50
    }
  }));
}

test('cleans OCR icon noise while retaining order, fares, and visible truncation', async () => {
  const lines = makeLines([
    '17:30, 28/11 58.000đ',
    'beBike',
    'Nhà Xe Tân Lập Thành, 84 Hùng Vương,',
    'S> P.9, Q.5, Hồ Chí Minh',
    'ọ Đại Học Công Nghiệp TP.HCM - Cổng 2,',
    '12 Nguyễn Văn Bảo, Phường Hạnh Thông...',
    '17:55, 28/11 56.000đ',
    'beBike',
    'O Cổng Chính - Đại Học Công Nghiệp Thực',
    '=2 Phẩm Thành Phố Hồ Chí Minh - Trụ Sở L...',
    'ọ Nhà Xe Cúc Phương, 97I Nguyễn Duy',
    'Dương, Phường An Đông, Thành Phố Hồ...',
    '18:30, 28/11 28.000đ',
    'beBike',
    'L- Điểm Đón Trả - Tòa Nhà Phương Nam, 28',
    '=2 Trường Sơn, Phường Tân Sơn Hòa, Thàn...',
    'ọ 766/16/23/8 Cách Mạng Tháng 8,',
    'Phường Tân Sơn Nhất, Thành Phố Hồ Chí...'
  ]);

  const orders = await window.BeeOcr.extractOrders(
    { lines },
    { height: (lines.length + 2) * 100 },
    null
  );

  assert.equal(orders.length, 3);
  assert.deepEqual(orders.map(order => order.fare), [58000, 56000, 28000]);
  assert.deepEqual(orders.map(order => order.serviceType), ['beBike', 'beBike', 'beBike']);
  assert.deepEqual(orders.map(order => order.address), [
    'Nhà Xe Tân Lập Thành, 84 Hùng Vương, Phường 9, Quận 5, TP. Hồ Chí Minh',
    'Cổng Chính - Đại Học Công Nghiệp Thực Phẩm TP. Hồ Chí Minh - Trụ Sở L…',
    'Điểm Đón Trả - Tòa Nhà Phương Nam, 28 Trường Sơn, Phường Tân Sơn Hòa, Thàn…'
  ]);
  assert.deepEqual(orders.map(order => order.dropoff), [
    'Đại Học Công Nghiệp TP. Hồ Chí Minh - Cổng 2, 12 Nguyễn Văn Bảo, Phường Hạnh Thông…',
    'Nhà Xe Cúc Phương, 97I Nguyễn Duy Dương, Phường An Đông, Thành Phố Hồ…',
    '766/16/23/8 Cách Mạng Tháng 8, Phường Tân Sơn Nhất, Thành Phố Hồ Chí…'
  ]);
});

test('repairs split ward names and OCR-corrupted house numbers', async () => {
  const lines = makeLines([
    '19:20, 27/11 20.000đ',
    'beBike',
    'O 235B/A11/3 Nguyễn Văn Cừ, Phường Cầu',
    '=>? Ông Lãnh, Thành Phố Hồ Chí Minh',
    'ọ 139a Đường Triệu Quang Phục, Phường Chợ Lớn, Thành Phố Hồ Chí Minh',
    '20:05, 27/11 41.000đ',
    'beBike',
    'l- ó/3 Nguyễn Văn Thủ, P.Đa Kao, Q.1, Hồ',
    '=2 Chí Minh',
    'ọ 96 Phan Huy Thực, P.Tân Kiểng, Q.7, Hồ',
    'Chí Minh'
  ]);

  const orders = await window.BeeOcr.extractOrders(
    { lines },
    { height: (lines.length + 2) * 100 },
    null
  );

  assert.equal(orders.length, 2);
  assert.deepEqual(orders.map(order => order.fare), [20000, 41000]);
  assert.deepEqual(orders.map(order => order.address), [
    '235B/A11/3 Nguyễn Văn Cừ, Phường Cầu Ông Lãnh, TP. Hồ Chí Minh',
    '6/3 Nguyễn Văn Thủ, Phường Đa Kao, Quận 1, TP. Hồ Chí Minh'
  ]);
});

test('geocodes a named pickup against its following numbered street', async () => {
  const originalFetch = global.fetch;
  const requestedUrls = [];
  global.fetch = async url => {
    requestedUrls.push(String(url));
    if (String(url).includes('nominatim.openstreetmap.org')) {
      return {
        ok: true,
        json: async () => [{
          lat: 10.75,
          lon: 106.68,
          display_name: '84 Hùng Vương, Phường 9, Quận 5, Hồ Chí Minh',
          address: { road: 'Hùng Vương' }
        }]
      };
    }
    return { ok: true, json: async () => ({ features: [] }) };
  };

  try {
    const point = await window.BeeGeocode.geocodeSmart(
      'Nhà Xe Tân Lập Thành, 84 Hùng Vương, Phường 9, Quận 5, TP. Hồ Chí Minh',
      null
    );

    assert.equal(point.road, 'Hùng Vương');
    assert.ok(new URL(requestedUrls[0]).searchParams.get('q').includes('Nhà Xe Tân Lập Thành'));
  } finally {
    global.fetch = originalFetch;
  }
});
