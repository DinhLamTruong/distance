/**
 * Module chuẩn hóa và sửa lỗi chính tả địa chỉ tiếng Việt cho Bee Distance
 */
(function(window) {
  'use strict';

  // 1. Từ điển chuẩn hóa địa danh TP.HCM & Việt Nam
  const DICT = [
    // Thủ Đức và các phường đặc biệt
    [/(?:thành\s+phố|thanh\s+pho|tp\.?|quận|quan|q\.?)?\s*thủ\s+đức\b/giu, 'TP. Thủ Đức'],
    [/(?:thành\s+phố|thanh\s+pho|tp\.?|quận|quan|q\.?)?\s*thu\s+duc\b/giu, 'TP. Thủ Đức'],

    // Các phường Hiệp Bình Chánh / Hiệp Bình Phước (tránh nhầm với Huyện Bình Chánh)
    [/(?:phường|p\.)?\s*hiệp\s+bình\s+chánh\b/giu, 'Phường Hiệp Bình Chánh'],
    [/(?:phường|p\.)?\s*hiep\s+binh\s+chanh\b/giu, 'Phường Hiệp Bình Chánh'],
    [/(?:phường|p\.)?\s*hiệp\s+bình\s+phước\b/giu, 'Phường Hiệp Bình Phước'],
    [/(?:phường|p\.)?\s*hiep\s+binh\s+phuoc\b/giu, 'Phường Hiệp Bình Phước'],

    // Gò Vấp (xử lý trường hợp Bee ghi 'Phường Gò Vấp')
    [/(?:phường|phuong|p\.)\s*gò\s+vấp\b/giu, 'Quận Gò Vấp'],
    [/(?:phường|phuong|p\.)\s*go\s+vap\b/giu, 'Quận Gò Vấp'],
    [/(?:quận|quan|q\.)?\s*gò\s+vấp\b/giu, 'Quận Gò Vấp'],
    [/(?:quận|quan|q\.)?\s*go\s+vap\b/giu, 'Quận Gò Vấp'],

    // Các quận số
    [/(?:quận|quan|q\.?)\s*1\b/giu, 'Quận 1'],
    [/(?:quận|quan|q\.?)\s*2\b/giu, 'Quận 2'],
    [/(?:quận|quan|q\.?)\s*3\b/giu, 'Quận 3'],
    [/(?:quận|quan|q\.?)\s*4\b/giu, 'Quận 4'],
    [/(?:quận|quan|q\.?)\s*5\b/giu, 'Quận 5'],
    [/(?:quận|quan|q\.?)\s*6\b/giu, 'Quận 6'],
    [/(?:quận|quan|q\.?)\s*7\b/giu, 'Quận 7'],
    [/(?:quận|quan|q\.?)\s*8\b/giu, 'Quận 8'],
    [/(?:quận|quan|q\.?)\s*9\b/giu, 'Quận 9'],
    [/(?:quận|quan|q\.?)\s*10\b/giu, 'Quận 10'],
    [/(?:quận|quan|q\.?)\s*11\b/giu, 'Quận 11'],
    [/(?:quận|quan|q\.?)\s*12\b/giu, 'Quận 12'],

    // Các quận chữ TP.HCM
    [/(?:quận|quan|q\.?)?\s*bình\s+thạnh\b/giu, 'Quận Bình Thạnh'],
    [/(?:quận|quan|q\.?)?\s*binh\s+thanh\b/giu, 'Quận Bình Thạnh'],
    [/(?:quận|quan|q\.?)?\s*phú\s+nhuận\b/giu, 'Quận Phú Nhuận'],
    [/(?:quận|quan|q\.?)?\s*phu\s+nhuan\b/giu, 'Quận Phú Nhuận'],
    [/(?:quận|quan|q\.?)?\s*tân\s+bình\b/giu, 'Quận Tân Bình'],
    [/(?:quận|quan|q\.?)?\s*tan\s+binh\b/giu, 'Quận Tân Bình'],
    [/(?:quận|quan|q\.?)?\s*tân\s+phú\b/giu, 'Quận Tân Phú'],
    [/(?:quận|quan|q\.?)?\s*tan\s+phu\b/giu, 'Quận Tân Phú'],
    [/(?:quận|quan|q\.?)?\s*bình\s+tân\b/giu, 'Quận Bình Tân'],
    [/(?:quận|quan|q\.?)?\s*binh\s+tan\b/giu, 'Quận Bình Tân'],

    // Các huyện ngoại thành (chỉ match khi có chữ huyện hoặc đứng độc lập, không match sau hiệp)
    [/(?:huyện|huyen|h\.)\s*bình\s+chánh\b/giu, 'Huyện Bình Chánh'],
    [/(?:huyện|huyen|h\.)\s*binh\s+chanh\b/giu, 'Huyện Bình Chánh'],
    [/(?:huyện|huyen|h\.?)?\s*hóc\s+môn\b/giu, 'Huyện Hóc Môn'],
    [/(?:huyện|huyen|h\.?)?\s*hoc\s+mon\b/giu, 'Huyện Hóc Môn'],
    [/(?:huyện|huyen|h\.?)?\s*củ\s+chi\b/giu, 'Huyện Củ Chi'],
    [/(?:huyện|huyen|h\.?)?\s*cu\s+chi\b/giu, 'Huyện Củ Chi'],
    [/(?:huyện|huyen|h\.?)?\s*nhà\s+bè\b/giu, 'Huyện Nhà Bè'],
    [/(?:huyện|huyen|h\.?)?\s*nha\s+be\b/giu, 'Huyện Nhà Bè'],
    [/(?:huyện|huyen|h\.?)?\s*cần\s+giờ\b/giu, 'Huyện Cần Giờ'],
    [/(?:huyện|huyen|h\.?)?\s*can\s+gio\b/giu, 'Huyện Cần Giờ'],

    // Các phường phổ biến tại TP.HCM & TP. Thủ Đức
    [/(?:phường|phuong|p\.?|f\.?)?\s*bình\s+trưng\s+đông\b/giu, 'Phường Bình Trưng Đông'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*binh\s+trung\s+dong\b/giu, 'Phường Bình Trưng Đông'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*bình\s+trưng\s+tây\b/giu, 'Phường Bình Trưng Tây'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*binh\s+trung\s+tay\b/giu, 'Phường Bình Trưng Tây'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*bình\s+trưng\b/giu, 'Bình Trưng'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*binh\s+trung\b/giu, 'Bình Trưng'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*an\s+phú\b/giu, 'Phường An Phú'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*an\s+phu\b/giu, 'Phường An Phú'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*thảo\s+điền\b/giu, 'Phường Thảo Điền'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*thao\s+dien\b/giu, 'Phường Thảo Điền'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*an\s+khánh\b/giu, 'Phường An Khánh'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*an\s+khanh\b/giu, 'Phường An Khánh'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*thạnh\s+mỹ\s+lợi\b/giu, 'Phường Thạnh Mỹ Lợi'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*thanh\s+my\s+loi\b/giu, 'Phường Thạnh Mỹ Lợi'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*cát\s+lái\b/giu, 'Phường Cát Lái'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*cat\s+lai\b/giu, 'Phường Cát Lái'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*hiệp\s+phú\b/giu, 'Phường Hiệp Phú'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*hiep\s+phu\b/giu, 'Phường Hiệp Phú'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+trung\b/giu, 'Phường Linh Trung'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+chiểu\b/giu, 'Phường Linh Chiểu'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+chieu\b/giu, 'Phường Linh Chiểu'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+tây\b/giu, 'Phường Linh Tây'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+tay\b/giu, 'Phường Linh Tây'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+đông\b/giu, 'Phường Linh Đông'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*linh\s+dong\b/giu, 'Phường Linh Đông'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*tam\s+phú\b/giu, 'Phường Tam Phú'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*tam\s+phu\b/giu, 'Phường Tam Phú'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*tam\s+bình\b/giu, 'Phường Tam Bình'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*tam\s+binh\b/giu, 'Phường Tam Bình'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*trường\s+thọ\b/giu, 'Phường Trường Thọ'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*truong\s+tho\b/giu, 'Phường Trường Thọ'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*phước\s+long\s+a\b/giu, 'Phường Phước Long A'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*phuoc\s+long\s+a\b/giu, 'Phường Phước Long A'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*phước\s+long\s+b\b/giu, 'Phường Phước Long B'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*phuoc\s+long\s+b\b/giu, 'Phường Phước Long B'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*tân\s+hưng\b/giu, 'Phường Tân Hưng'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*tan\s+hung\b/giu, 'Phường Tân Hưng'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*an\s+nhơn\b/giu, 'Phường An Nhơn'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*an\s+nhon\b/giu, 'Phường An Nhơn'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*bến\s+nghé\b/giu, 'Phường Bến Nghé'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*ben\s+nghe\b/giu, 'Phường Bến Nghé'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*bến\s+thành\b/giu, 'Phường Bến Thành'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*ben\s+thanh\b/giu, 'Phường Bến Thành'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*đa\s+kao\b/giu, 'Phường Đa Kao'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*da\s+kao\b/giu, 'Phường Đa Kao'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*cầu\s+ông\s+lãnh\b/giu, 'Phường Cầu Ông Lãnh'],
    [/(?:phường|phuong|p\.?|f\.?)?\s*cau\s+ong\s+lanh\b/giu, 'Phường Cầu Ông Lãnh'],

    // Các tên đường nổi tiếng
    [/\blê\s+thị\s+hồng\b/giu, 'Lê Thị Hồng'],
    [/\ble\s+thi\s+hong\b/giu, 'Lê Thị Hồng'],
    [/\bphan\s+văn\s+trị\b/giu, 'Phan Văn Trị'],
    [/\bphan\s+van\s+tri\b/giu, 'Phan Văn Trị'],
    [/\bvườn\s+điều\b/giu, 'Vườn Điều'],
    [/\bvuon\s+dieu\b/giu, 'Vườn Điều'],
    [/\bnguyễn\s+duy\s+trinh\b/giu, 'Nguyễn Duy Trinh'],
    [/\bnguyen\s+duy\s+trinh\b/giu, 'Nguyễn Duy Trinh'],
    [/\bmai\s+chí\s+thọ\b/giu, 'Mai Chí Thọ'],
    [/\bmai\s+chi\s+tho\b/giu, 'Mai Chí Thọ'],
    [/\bxa\s+lộ\s+hà\s+nội\b/giu, 'Xa Lộ Hà Nội'],
    [/\bxa\s+lo\s+ha\s+noi\b/giu, 'Xa Lộ Hà Nội'],
    [/\blương\s+định\s+của\b/giu, 'Lương Định Của'],
    [/\bluong\s+dinh\s+cua\b/giu, 'Lương Định Của'],
    [/\bnguyễn\s+thị\s+định\b/giu, 'Nguyễn Thị Định'],
    [/\bnguyen\s+thi\s+dinh\b/giu, 'Nguyễn Thị Định'],
    [/\btrần\s+não\b/giu, 'Trần Não'],
    [/\btran\s+nao\b/giu, 'Trần Não'],
    [/\bđồng\s+khởi\b/giu, 'Đồng Khởi'],
    [/\bdong\s+khoi\b/giu, 'Đồng Khởi'],
    [/\btrần\s+hưng\s+đạo\b/giu, 'Trần Hưng Đạo'],
    [/\btran\s+hung\s+dao\b/giu, 'Trần Hưng Đạo']
  ];

  function toTitleCase(str) {
    if (!str) return '';
    return str.split(/(\s+|[,./\-])/).map(token => {
      if (!token || /^\s+$/.test(token) || /^[,./\-]+$/.test(token)) return token;
      if (/^(tp|hcm|kp|vn|q\d+|p\d+|cod)$/i.test(token)) return token.toUpperCase();
      return token.charAt(0).toUpperCase() + token.slice(1).toLowerCase();
    }).join('');
  }

  function cleanAndFixAddress(address) {
    if (!address) return '';
    let str = ' ' + String(address).trim() + ' ';

    // 1. Loại bỏ các từ rác giao diện app Bee
    str = str
      .replace(/(?:^|\s+)(?:chuyến\s+đi\s+hẹn\s+giờ|chuyến\s+đang\s+có|chuyến\s+đã\s+nhận|hôm\s+nay|giao\s+hàng|lấy\s+hàng|hoàn\s+thành|đang\s+giao|đã\s+giao|đã\s+nhận|chi\s+tiết\s+đơn|chi\s+tiết|liên\s+hệ|gọi\s+ngay|thu\s+hộ\s+cod|thu\s+hộ|tiền\s+mặt|khách\s+hàng|người\s+nhận|người\s+gửi|đã\s+thanh\s+toán|chưa\s+thanh\s+toán|thanh\s+toán)(?:\s+đ|\s+đồng|\s+vnd)?(?:\s+|$)/giu, ' ')
      .replace(/\b\d{1,2}:\d{2}(?:\s*,\s*\d{1,2}\/\d{1,2})?\b/g, ' ')
      .replace(/\b\d{1,3}(?:[.,]\d{3})+\s*(?:đ|đồng|vnd)?\b/gi, ' ')
      .replace(/^[•·\-–—|¦*~»«_=+]+/g, ' ')
      .replace(/[|¦~»«_=+]+/g, ' ')
      .replace(/\s+/g, ' ');

    // 2. Sửa lỗi số nhà do OCR đọc nhầm l, I thành 1
    str = str.replace(/^([lI|])(\d+[\s,/])/g, '1$2');

    // 3. Chuẩn hóa viết tắt dính liền (P.Hiệp -> Phường Hiệp, TP.Thủ Đức -> TP. Thủ Đức, Q.Gò Vấp -> Quận Gò Vấp)
    str = str.replace(/([,\s])(?:p\.|f\.)(?=[a-z\p{L}])/giu, '$1Phường ');
    str = str.replace(/([,\s])(?:q\.)(?=[a-z\p{L}])/giu, '$1Quận ');
    str = str.replace(/([,\s])(?:tp\.|t\.p\.)(?=[a-z\p{L}])/giu, '$1TP. ');

    // 4. Chuẩn hóa tên đường viết tắt: đg., dg., đ., d., h., hem, ng., ngo, so
    str = str.replace(/(?:^|\s+)(?:đg\.|dg\.|đ\.|d\.)\s*/giu, ' Đường ');
    str = str.replace(/(?:^|\s+)duong(?:\s+|$)/giu, ' Đường ');
    str = str.replace(/(?:^|\s+)(?:h\.)\s*/giu, ' Hẻm ');
    str = str.replace(/(?:^|\s+)hem(?:\s+|$)/giu, ' Hẻm ');
    str = str.replace(/(?:^|\s+)(?:ng\.)\s*/giu, ' Ngõ ');
    str = str.replace(/(?:^|\s+)ngo(?:\s+|$)/giu, ' Ngõ ');
    str = str.replace(/(?:^|\s+)so\s+(\d+)\b/giu, ' Số $1');

    // 5. Áp dụng từ điển địa danh
    DICT.forEach(([pat, rep]) => {
      str = str.replace(pat, rep);
    });

    // 6. Chuẩn hóa Phường / Quận / Khu Phố dạng số
    str = str.replace(/(?:^|\s+)(?:p\.|f\.)\s*([0-9]+)\b/giu, ' Phường $1');
    str = str.replace(/(?:^|\s+)(?:p\.|f\.)\s+(?=[a-z\p{L}])/giu, ' Phường ');
    str = str.replace(/(?:^|\s+)(?:q\.)\s*([0-9]+)\b/giu, ' Quận $1');
    str = str.replace(/(?:^|\s+)(?:q\.)\s+(?=[a-z\p{L}])/giu, ' Quận ');
    str = str.replace(/(?:^|\s+)(?:kp\.?)\s*([0-9]+)\b/giu, ' Khu Phố $1');

    // 7. Khử lặp tiền tố
    str = str.replace(/(?:phường|p\.)\s+(?:phường|p\.)\s+/giu, 'Phường ');
    str = str.replace(/(?:quận|q\.)\s+(?:quận|q\.)\s+/giu, 'Quận ');
    str = str.replace(/(?:đường|đ\.)\s+(?:đường|đ\.)\s+/giu, 'Đường ');
    str = str.replace(/(?:quận|q\.)\s+tp\.\s*thủ\s+đức/giu, 'TP. Thủ Đức');

    // 8. Chuẩn hóa Tỉnh / Thành phố
    str = str.replace(/(?:^|\s+)(?:tp\.?|t\.p\.?)\s*(?:hcm|ho\s*chi\s*minh)(?:\s+|$)/giu, ' TP. Hồ Chí Minh ');
    str = str.replace(/(?:^|\s+)thành\s+phố\s+hồ\s*chí\s*minh(?:\s+|$)/giu, ' TP. Hồ Chí Minh ');
    str = str.replace(/(?:^|\s+)thanh\s+pho\s+ho\s*chi\s*minh(?:\s+|$)/giu, ' TP. Hồ Chí Minh ');
    str = str.replace(/(?:^|\s+)ho\s*chi\s*minh(?:\s*70000)?(?:\s+|$)/giu, ' TP. Hồ Chí Minh ');
    str = str.replace(/(?:^|\s+)hcm(?:\s+|$)/giu, ' TP. Hồ Chí Minh ');
    str = str.replace(/(?:^|\s+)viet\s*nam(?:\s+|$)/giu, ' Việt Nam ');

    // 9. Dấu câu & khoảng trắng
    str = str
      .replace(/\s*,\s*,+/g, ',')
      .replace(/\s*,/g, ',')
      .replace(/,(?=\S)/g, ', ')
      .replace(/^[,\s.-]+|[,\s.-]+$/g, '')
      .replace(/\s+/g, ' ');

    // 10. Title Case
    str = toTitleCase(str);

    // 11. Hậu kỳ chuẩn hóa
    str = str
      .replace(/\bTp\.\s*/g, 'TP. ')
      .replace(/\bHcm\b/g, 'HCM')
      .replace(/\bCod\b/g, '')
      .replace(/\s+Đ$/i, '')
      .replace(/^[,\s.-]+|[,\s.-]+$/g, '')
      .trim();

    return str;
  }

  window.AddressFixer = {
    cleanAndFixAddress,
    toTitleCase
  };
})(typeof window !== 'undefined' ? window : this);
