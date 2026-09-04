# Gia Phả Việt

Cây gia phả trực tuyến, miễn phí trọn đời, cả nhà cùng thêm và sửa được từ điện thoại lẫn máy tính.

Toàn bộ hệ thống gồm ba mảnh, không có máy chủ nào phải trả tiền:

| Mảnh | Vai trò | Chi phí |
|---|---|---|
| Google Sheet | Nơi chứa dữ liệu và lưu lịch sử phiên bản | Miễn phí |
| Apps Script | Cổng để trang web ghi ngược vào Sheet và tải ảnh lên Drive | Miễn phí |
| `index.html` | Trang web đọc dữ liệu và vẽ cây | Miễn phí khi đặt trên GitHub Pages hoặc Netlify |

Người trong nhà chỉ cần một đường link. Họ bấm **Thêm người**, điền form, chọn ảnh từ điện thoại là xong. Không ai phải mở Google Sheet, không ai phải gõ mã số.

---

## Cài đặt

### Bước 1. Tạo Google Sheet

Mở [sheets.new](https://sheets.new). Thế là xong, một file trống là đủ.

Không cần kẻ bảng hay gõ tiêu đề. Ngay lần đầu trang web gọi tới, Apps Script tự tạo hai tab và tự điền dòng tiêu đề: `GiaPha` chứa thông tin từng người, `TaiKhoan` chứa tài khoản và nhánh được giao. Nó cũng tự đặt định dạng ô về văn bản thuần để `05/09/1950` không bị đổi thành ngày tháng.

File mới luôn có sẵn một tab tên `Trang tính1` mà script không dùng tới. Đổi tên nó thành `GiaPha` ngay từ đầu, hoặc cứ để đó rồi xóa sau, đều được.

Chỉ dùng tới `mau-gia-pha.csv` khi bạn muốn nhập sẵn một loạt người bằng cách dán thẳng vào bảng, thay vì gõ từng người qua form trên web.

### Bước 2. Dựng cổng ghi

Trong Sheet vừa tạo, chọn **Tiện ích mở rộng → Apps Script**. Xóa hết nội dung mẫu, dán toàn bộ `apps-script.gs` vào.

Bấm **Triển khai → Tùy chọn triển khai mới → Ứng dụng web** với hai lựa chọn:

- Thực thi với tư cách: **Tôi**
- Ai có quyền truy cập: **Bất kỳ ai**

Lần đầu Google sẽ hỏi cấp quyền. Chọn tài khoản của bạn, bấm **Nâng cao → Chuyển đến … (không an toàn) → Cho phép**. Cảnh báo này xuất hiện vì script do bạn tự viết chứ chưa qua thẩm định của Google, không phải dấu hiệu có vấn đề.

Chép đường dẫn kết thúc bằng `/exec` và giữ lại.

### Bước 3. Đưa trang web lên mạng

Chọn một trong ba cách, đều miễn phí và không giới hạn lượt xem:

- **Netlify Drop** — vào [app.netlify.com/drop](https://app.netlify.com/drop), kéo thả cả thư mục này vào trang. Ra link ngay, không cần tài khoản Git.
- **GitHub Pages** — đẩy thư mục lên một repository, vào Settings → Pages, chọn nhánh `main` thư mục `/root`.
- **Cloudflare Pages** — nối với repository GitHub, để trống phần lệnh build.

### Bước 4. Nối trang web với dữ liệu

Mở trang vừa đưa lên, bấm nút cài đặt ở góc phải thanh trên cùng. Dán đường dẫn `/exec` vào ô **Đường dẫn cổng ghi**, rồi bấm **Lưu & tải lại**.

Trang sẽ báo chưa có tài khoản nào. Bấm **Lập tài khoản quản trị**, đặt tên đăng nhập và mật khẩu cho chính bạn. Từ đây bạn là người cấp tài khoản cho những người còn lại.

Cấu hình được lưu trong trình duyệt của từng người. Muốn cả nhà khỏi phải cấu hình, mở `index.html` và điền sẵn vào đầu file:

```js
var CONFIG = {
  sheetId:  "",
  sheetName:"GiaPha",
  title:    "Gia phả họ Nguyễn"
};
```

---

## Tài khoản và phân quyền

Ai mở link cũng xem được **toàn bộ** cây, kể cả khi chưa đăng nhập. Sửa thì phải có tài khoản.

| Quyền | Xem | Sửa |
|---|---|---|
| Quản trị | Toàn bộ | Toàn bộ, kể cả cấp và thu hồi tài khoản |
| Biên tập | Toàn bộ | Chỉ trong những nhánh được giao |
| Chỉ xem | Toàn bộ | Không sửa gì |

### Giao nhánh cho một người

Đăng nhập bằng tài khoản quản trị, bấm tên mình ở thanh trên cùng, chọn **Quản lý tài khoản → Thêm tài khoản**. Đặt quyền là *Biên tập*, rồi ở ô **Nhánh được giao** chọn người đứng đầu nhánh.

Ví dụ giao nhánh ông Nguyễn Hữu Ba cho tài khoản `trongnt`. Tài khoản đó sẽ sửa được ông Nguyễn Hữu Ba, vợ ông, toàn bộ con cháu bên dưới và dâu rể của họ. Những người ở nhánh khác vẫn nhìn thấy đầy đủ nhưng nút Sửa không hiện.

Một tài khoản giao được nhiều nhánh cùng lúc. Khi đăng nhập, những người bạn sửa được có một chấm xanh nhỏ ở góc thẻ.

### Vì sao phải kiểm tra ở phía máy chủ

Việc ẩn nút Sửa trên trình duyệt chỉ là cho gọn mắt. Toàn bộ phép kiểm tra quyền nằm trong Apps Script, nên người biết kỹ thuật gọi thẳng vào cổng ghi cũng không vượt được ranh giới nhánh. Mật khẩu lưu dưới dạng băm SHA-256 kèm chuỗi muối riêng cho từng tài khoản, không lưu bản rõ. Phiên đăng nhập là một thẻ ký bằng HMAC, giữ 30 ngày.

Nếu muốn bắt buộc đăng nhập mới xem được cây, sửa dòng này trong `apps-script.gs` rồi triển khai lại:

```js
var REQUIRE_LOGIN_TO_VIEW = true;
```

Mất mật khẩu quản trị thì mở tab `TaiKhoan` trong Google Sheet, xóa hàng của tài khoản đó, trang sẽ mời bạn lập lại tài khoản quản trị đầu tiên.

---

## Ý nghĩa các cột

Bạn không cần gõ tay các cột này nếu dùng form trên web. Bảng dưới để tra khi cần sửa hàng loạt trực tiếp trong Sheet.

| Cột | Ý nghĩa | Ví dụ |
|---|---|---|
| `id` | Mã riêng của mỗi người, không được trùng | `7` hoặc `p1a2b3` |
| `ho_ten` | Bắt buộc. Thiếu cột này thì hàng bị bỏ qua | `Nguyễn Văn Trọng` |
| `ten_thuong_goi` | Tên gọi ở nhà, tên hiệu | `ông Ba` |
| `gioi_tinh` | `Nam` hoặc `Nữ`, quyết định màu vòng quanh ảnh | `Nam` |
| `nam_sinh` | Chỉ năm, hoặc đủ ngày tháng năm | `1972` hoặc `05/09/1972` |
| `nam_mat` | Để trống nghĩa là còn sống | `12/03/1996` |
| `ngay_gio` | Ngày giỗ âm lịch. Bỏ trống thì tự quy đổi từ `nam_mat` | `15/7` |
| `anh` | Link ảnh. Link chia sẻ Google Drive dán thẳng vào được | |
| `cha_id`, `me_id` | Mã của cha và mẹ. Đây là thứ dựng nên cây | `3` và `4` |
| `vo_chong_id` | Mã vợ hoặc chồng, nhiều người thì ngăn bằng dấu phẩy | `8` |
| `vai_tro` | Hiện dưới tên bằng chữ nhỏ màu vàng | `Trưởng tộc` |
| `que_quan`, `noi_an_tang`, `ghi_chu` | Chỉ hiện trong ngăn chi tiết | |

Không có cột đời. Đời được suy ra từ chuỗi cha con nên không bao giờ lệch.

---

## Cách trang web hiểu quan hệ

**Đời** đếm từ thủy tổ xuống. Thủy tổ là người không khai cha lẫn mẹ và có nhiều con cháu nhất.

**Chi** hình thành từ mỗi người con của thủy tổ. Toàn bộ con cháu bên dưới thừa hưởng màu của chi đó, hiện thành vạch màu mỏng trên đầu mỗi thẻ. Bấm nút thống kê để xem danh sách các chi và lọc riêng từng chi.

**Vợ chồng** nối bằng vạch đỏ ngang, đứng cạnh nhau, không tính vào huyết thống. Người cưới về không cần khai cha mẹ.

**Anh chị em** không cần khai. Cứ chung `cha_id` hoặc `me_id` là tự thành anh chị em.

Khi bạn thêm vợ cho một người, script tự điền ngược lại vào hàng của người kia. Không cần khai hai lần.

---

## Ngày giỗ

Điền `nam_mat` đủ ngày tháng năm dương lịch là trang tự quy sang âm lịch và nhắc. Nếu trong nhà đã quen một ngày giỗ âm lịch cố định khác, điền thẳng vào cột `ngay_gio` theo dạng `15/7`, giá trị này được ưu tiên.

Nút **Giỗ sắp tới** liệt kê cả năm, kèm ngày dương tương ứng và số ngày còn lại. Con số đỏ trên nút đếm số đám giỗ trong 60 ngày tới.

Phép quy đổi dùng thuật toán âm lịch Việt Nam múi giờ +7, khớp với lịch treo tường.

---

## Ảnh

Chọn ảnh trong form là trang tự thu nhỏ còn cạnh dài 420 pixel rồi tải lên thư mục `Gia pha - anh` trên Drive của bạn, đặt quyền ai có link cũng xem được. Ảnh gốc trong máy không bị đụng tới.

Ảnh chân dung chụp thẳng mặt hiển thị đẹp nhất vì khung là hình tròn.

---

## An toàn dữ liệu

Mọi thay đổi đều nằm trong Google Sheet. Vào **Tệp → Lịch sử phiên bản → Xem lịch sử phiên bản** là thấy ai sửa gì lúc nào và khôi phục được bản cũ. Xóa nhầm một người vẫn lấy lại được.

Trang web không gửi dữ liệu đi đâu ngoài Google Sheet và Google Drive của chính bạn.

Tab `TaiKhoan` nằm chung file Sheet với gia phả. Nếu bạn chia sẻ file Sheet cho người khác xem, họ sẽ thấy tab này. Chuỗi trong cột `mat_khau` là bản băm chứ không phải mật khẩu, nhưng vẫn nên ẩn tab đó đi cho gọn: chuột phải vào tên tab, chọn Ẩn trang tính.

---

## Khi có trục trặc

**Trang báo không đọc được Google Sheet.** Sheet chưa được chia sẻ. Bấm Chia sẻ, đổi thành *Bất kỳ ai có đường liên kết · Người xem*. Cách này chỉ cần khi bạn dùng chế độ chỉ xem bằng ID Sheet. Dùng cổng ghi thì không cần chia sẻ Sheet.

**Báo `Unexpected token '<'` hoặc nói địa chỉ trả về một trang web.** Bạn đã dán địa chỉ file Google Sheet vào ô cổng ghi. Hai địa chỉ đó khác nhau. Địa chỉ Sheet bắt đầu bằng `docs.google.com/spreadsheets`, còn cổng ghi bắt đầu bằng `script.google.com` và kết thúc bằng `/exec`. Cổng ghi chỉ có sau khi bạn dán mã vào Apps Script và bấm Triển khai.

**Bấm lưu báo lỗi kết nối.** Kiểm tra hai điểm: đường dẫn phải kết thúc bằng `/exec` chứ không phải `/dev`, và quyền truy cập phải là *Bất kỳ ai*. Mỗi lần sửa script phải **Triển khai lại** thì thay đổi mới có hiệu lực.

**Báo người này nằm ngoài nhánh được giao.** Đúng như thiết kế. Nhờ quản trị mở thêm nhánh, hoặc kiểm tra lại xem người đó đã khai `cha_id` và `me_id` nối về gốc nhánh chưa. Một người chưa khai cha mẹ thì không thuộc nhánh nào cả.

**Đăng nhập xong vẫn không thấy nút Sửa.** Tài khoản đang ở quyền *Chỉ xem*, hoặc là *Biên tập* nhưng chưa được giao nhánh nào.

**Ngày sinh biến thành số lạ trong Sheet.** Cột đang ở định dạng ngày tháng. Bôi đen cột, chọn Định dạng → Số → Văn bản thuần túy.

**Hai người bị vẽ tách rời.** Một trong hai thiếu `cha_id` và `me_id`, hoặc mã khai không khớp mã thật. Mở ngăn chi tiết xem phần Quan hệ để đối chiếu.

**Cây quá rộng khó nhìn.** Bấm nút khung hình ở góc trái dưới để thu vừa màn hình, hoặc chọn một người rồi bật *Chỉ dòng dõi* để mờ những nhánh không liên quan.

---

## Dùng thử trước khi cài

Mở thẳng `index.html` bằng trình duyệt là thấy ngay giao diện với dữ liệu mẫu. Muốn xem thử bằng dữ liệu thật mà chưa dựng Apps Script, vào cài đặt và dán nội dung CSV vào ô **Dán dữ liệu CSV**.
