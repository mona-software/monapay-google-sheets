# MONA Pay cho Google Sheets

Apps Script gắn với một Google Sheet, thêm menu **MONA Pay → Đồng bộ** và có thể cài trigger chạy mỗi giờ. Script gọi API giao dịch theo VA, ghi tối đa 100 giao dịch/trang và bỏ qua bản ghi đã có theo `transaction_code`.

## Cài vào Sheet

1. Tạo/mở Google Sheet đích, chọn **Extensions → Apps Script**.
2. Chép `Code.gs` và `appsscript.json` vào project.
3. Trong **Project Settings → Script Properties**, thêm:
   - `MONAPAY_USERNAME`
   - `MONAPAY_PASSWORD`
   - `MONAPAY_VIRTUAL_ACCOUNT_NUMBER`
   - `MONAPAY_BASE_URL` (không bắt buộc, mặc định `https://api.monapay.vn`)
   - `MONAPAY_SHEET_NAME` (không bắt buộc, mặc định `MONA Pay Transactions`)
4. Reload Sheet, chọn **MONA Pay → Đồng bộ** và cấp quyền lần đầu.
5. Chọn **MONA Pay → Bật đồng bộ mỗi giờ** nếu muốn tạo time-driven trigger.

Credential nằm trong Script Properties, không nằm trong ô Sheet. Chỉ chia sẻ quyền sửa Apps Script cho người được phép dùng tài khoản MONA Pay. Script chỉ gọi login và GET giao dịch, nên không cần Client Secret.

## Cách đồng bộ

- Trang 1 là giao dịch mới nhất; script đọc tối đa 100 trang trong lần đầu.
- Khi gặp `transaction_code` đã có, script xử lý hết trang hiện tại rồi dừng.
- Lock theo document ngăn hai lượt trigger ghi trùng; cột `transaction_code` là khoá chống trùng.
- Sheet lưu cả tên trường payload webhook và alias từ API (`transaction_content`, `transaction_date`).

Google Apps Script không phải hệ thống chốt đơn real-time. Dùng Sheet để theo dõi/đối soát; luồng bán hàng vẫn cần webhook có HMAC, database transaction và unique constraint trên `transaction_code`.

Tài liệu: https://monapay.vn/docs · llms: https://monapay.vn/llms.txt · Hotline 1900 636 648 · info@themona.global
