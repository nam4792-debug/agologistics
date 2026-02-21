# HƯỚNG DẪN SỬ DỤNG LOGISPRO

> **Phiên bản**: 1.0.0
> **Ngày cập nhật**: 13/02/2026
> **Ứng dụng**: LogisPro — Hệ thống Quản lý Logistics Xuất Khẩu

---

## MỤC LỤC

1. [Đăng nhập & Xác thực](#1-đăng-nhập--xác-thực)
2. [Dashboard — Tổng quan](#2-dashboard--tổng-quan)
3. [Quản lý Booking](#3-quản-lý-booking)
4. [Quản lý Shipment (Lô hàng)](#4-quản-lý-shipment-lô-hàng)
5. [Logistics & Điều phối xe](#5-logistics--điều-phối-xe)
6. [Quản lý Chứng từ](#6-quản-lý-chứng-từ)
7. [Vendors & Chi phí](#7-vendors--chi-phí)
8. [Rủi ro & Cảnh báo](#8-rủi-ro--cảnh-báo)
9. [Phân tích & Báo cáo](#9-phân-tích--báo-cáo)
10. [Cài đặt](#10-cài-đặt)
11. [Quản trị (Admin)](#11-quản-trị-admin)
12. [Trợ lý AI](#12-trợ-lý-ai)
13. [Quy trình E2E hoàn chỉnh](#13-quy-trình-e2e-hoàn-chỉnh)

---

## 1. ĐĂNG NHẬP & XÁC THỰC

### Thông tin đăng nhập mặc định

| Trường | Giá trị |
|--------|---------|
| Email | `admin@logispro.vn` |
| Mật khẩu | `admin123` |

### Quy trình đăng nhập

1. Mở ứng dụng LogisPro
2. Nhập email và mật khẩu
3. Hệ thống tự động nhận diện thiết bị (Device Fingerprint)
4. Kiểm tra license key → Nếu hợp lệ → Đăng nhập thành công
5. Nếu thiết bị mới → Tự động kích hoạt (trong giới hạn số thiết bị)

### Bảo mật

- **Xác thực JWT** với thời hạn 7 ngày
- **Device Binding**: Mỗi license giới hạn số thiết bị tối đa
- **Admin Whitelist**: Thiết bị admin được quản lý qua danh sách trắng

---

## 2. DASHBOARD — TỔNG QUAN

Dashboard hiển thị tổng quan toàn bộ hoạt động logistics:

### Các thẻ số liệu

| Thẻ | Mô tả | Nguồn dữ liệu |
|-----|--------|----------------|
| Shipments | Tổng số, Đang vận chuyển, Tại cảng, Đã giao, Chờ, Thông quan | Bảng `shipments` |
| Bookings | Tổng, FCL, AIR, Chờ, Đã xác nhận | Bảng `bookings` |
| Documents | Tổng, Đã xác thực, Chờ duyệt | Bảng `documents` |
| Alerts | Tổng cảnh báo, Khẩn cấp, Chưa đọc | Bảng `notifications` |
| Deadlines | Sắp đến hạn, Khẩn cấp | Bảng `booking_deadlines` |
| Dispatches | Tổng, Đang hoạt động | Bảng `truck_dispatches` |

### Lô hàng gần đây

Hiển thị 5 lô hàng mới nhất kèm:
- Mã shipment, loại (FCL/AIR), trạng thái
- Cảng xuất → Cảng đến
- Mã booking liên kết (nếu có)

---

## 3. QUẢN LÝ BOOKING

### 3.1 Danh sách Bookings

- **Truy cập**: Sidebar → Bookings
- **Tìm kiếm**: Theo mã booking, cảng, tàu/chuyến bay
- **Lọc**: Theo trạng thái (PENDING, CONFIRMED, ALLOCATED, USED) và loại (FCL, AIR)

### 3.2 Tạo Booking mới

Nhấn **"New Booking"** → Điền form:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Booking Number | Tự sinh | Mã booking (VD: BK-2026-XXXX) |
| Type | ✅ | FCL (Container) hoặc AIR (Hàng không) |
| Forwarder | ✅ | Chọn từ danh sách forwarder đã tạo |
| Vessel/Flight | ✅ | Tên tàu hoặc chuyến bay |
| Voyage Number | | Số chuyến |
| Origin Port | ✅ | Cảng xuất phát |
| Destination Port | ✅ | Cảng đích |
| ETD | ✅ | Ngày khởi hành dự kiến |
| ETA | ✅ | Ngày đến dự kiến |
| Container Type | | 20GP, 40GP, 40HC, 45HC |
| Container Count | | Số lượng container |
| Freight Rate (USD) | | Giá cước vận chuyển |
| Shipping Line | | Hãng tàu |
| Cut-off SI | | Deadline nộp SI |
| Cut-off VGM | | Deadline nộp VGM |
| Cut-off CY | | Deadline hạ container |
| Notes | | Ghi chú |

### 3.3 Xác nhận Booking (Confirm)

1. Mở chi tiết booking → Nhấn **"Confirm Booking"**
2. Hệ thống tự động:
   - Đặt `sales_confirmed = true`
   - Tạo các task tự động (Kiểm tra chứng từ, Xếp container, v.v.)
   - Trạng thái → `CONFIRMED`

### 3.4 Xóa Booking

- Xóa cascade: Tự động xóa `booking_deadlines`, `workflow_tasks`, `truck_dispatches` liên quan

---

## 4. QUẢN LÝ SHIPMENT (LÔ HÀNG)

### 4.1 Danh sách Shipments

- **Truy cập**: Sidebar → Shipments
- **Tìm kiếm & Lọc**: Theo mã, trạng thái, loại
- **Xóa**: Hỗ trợ cascade delete (bookings, documents, dispatches liên quan)

### 4.2 Tạo Shipment mới

Nhấn **"New Shipment"** → Điền form:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Shipment Number | Tự sinh | Mã lô hàng |
| Type | ✅ | FCL, AIR |
| Customer | ✅ | Chọn khách hàng |
| Origin/Destination | ✅ | Cảng xuất/đích |
| Cargo Description | ✅ | Mô tả hàng hóa |
| **Liên kết Booking** | | Chọn booking chưa liên kết (PENDING + CONFIRMED) |

> **Lưu ý**: Khi chọn booking, hệ thống tự động điền cảng xuất/đích và thông tin khách hàng.

### 4.3 Quy trình trạng thái

```
DRAFT → PENDING → BOOKED → IN_TRANSIT → AT_PORT → IN_CUSTOMS → DELIVERED
```

Nhấn vào từng bước trên thanh tiến trình để cập nhật trạng thái.

### 4.4 Chi tiết Shipment

- **Thông tin cơ bản**: Mã, loại, trạng thái, khách hàng, cảng
- **Chứng từ**: Upload, xem, tải xuống
- **Booking liên kết**: Xem booking liên quan
- **Chỉnh sửa**: Toàn bộ thông tin shipment

---

## 5. LOGISTICS & ĐIỀU PHỐI XE

### 5.1 Trang Logistics

- **Truy cập**: Sidebar → Logistics
- **Hai mục chính**:
  - **Bookings đã xác nhận**: Danh sách booking đang chờ điều phối
  - **Dispatches**: Tất cả lệnh điều xe

### 5.2 Tạo Dispatch (Điều xe)

Từ trang Logistics hoặc Chi tiết Booking → **"Schedule Dispatch"**:

| Trường | Mô tả |
|--------|-------|
| Driver Name | Tên tài xế |
| Driver Phone | SĐT tài xế |
| Truck Plate | Biển số xe đầu kéo |
| Trailer Plate | Biển số rơ-mooc |
| Container Number | Số container |
| Seal Number | Số seal |
| Pickup Date & Time | Ngày giờ lấy hàng |
| Pickup Location | Địa điểm lấy hàng |
| Delivery Location | Địa điểm giao hàng |

### 5.3 Trạng thái Dispatch

```
SCHEDULED → EN_ROUTE → ARRIVED → LOADING → COMPLETED
```

### 5.4 Thẻ Dispatch hiển thị

- Mã booking + Mã shipment liên kết
- Tên tài xế + SĐT
- Biển số xe
- Container/Seal
- Lộ trình: Pickup → Delivery
- Ngày giờ lấy hàng

---

## 6. QUẢN LÝ CHỨNG TỪ

### 6.1 Danh sách chứng từ

- **Truy cập**: Sidebar → Documents
- **Phân nhóm**: Theo Shipment (mỗi shipment hiển thị các chứng từ liên quan)

### 6.2 Upload chứng từ

1. Chọn shipment → Nhấn **"Upload"**
2. Chọn file (hỗ trợ multi-file)
3. Hệ thống gợi ý loại chứng từ dựa trên tên file:
   - `BL` → Bill of Lading
   - `Invoice` → Commercial Invoice
   - `Packing` → Packing List
   - `CO` → Certificate of Origin
   - v.v.
4. Chọn loại chứng từ → Nhấn **"Upload"**

### 6.3 Tải xuống

- **Từng file**: Nhấn icon download trên mỗi chứng từ
- **Hàng loạt**: Chọn nhiều file → **"Bulk Download"**

### 6.4 AI Analysis

- So sánh chứng từ bằng AI (document comparison)

---

## 7. VENDORS & CHI PHÍ

### 7.1 Thống kê Vendor

| Thẻ | Mô tả | Nguồn |
|-----|--------|-------|
| Tổng nợ | SUM(freight_rate_usd) các booking CONFIRMED | SQL thực |
| Chờ thanh toán | SUM(freight_rate_usd) booking PENDING | SQL thực |
| Vendor hoạt động | COUNT forwarders ACTIVE | SQL thực |

### 7.2 Tạo Vendor mới

Nhấn **"Add Vendor"** → Điền form:

| Trường | Bắt buộc | Mô tả |
|--------|----------|-------|
| Company Name | ✅ | Tên công ty |
| Contact Person | | Người liên hệ |
| Email | | Email liên hệ |
| Phone | | Số điện thoại |
| Address | | Địa chỉ |

### 7.3 Chi tiết Vendor

- **Điểm hiệu suất**: On-time Rate, Doc Accuracy Rate, Performance Score
- **Xếp hạng**: A (Xuất sắc) → B → C → D → F (Kém)
- **Nợ phải trả**: Phân tích từ dữ liệu booking thực

### 7.4 Chi phí cước

- Hiển thị tất cả booking có `freight_rate_usd > 0`
- Thông tin: Mã booking, Tên forwarder, Cảng, Giá cước, Trạng thái

---

## 8. RỦI RO & CẢNH BÁO

### 8.1 Bảng điều khiển Rủi ro

- **Truy cập**: Sidebar → Risk

### 8.2 Cách tính rủi ro

Dựa trên **deadline thực** từ booking đã xác nhận:

| Mức độ | Điều kiện | Màu |
|--------|-----------|-----|
| CRITICAL | ≤ 1 ngày đến hạn | 🔴 Đỏ |
| HIGH | ≤ 2 ngày đến hạn | 🟠 Cam |
| MEDIUM | ≤ 3 ngày đến hạn | 🟡 Vàng |
| LOW | > 3 ngày | 🟢 Xanh |

### 8.3 Danh mục rủi ro

- **DEADLINE**: Hạn chót CY, SI, VGM, ETD
- **DOCUMENTS**: Chứng từ thiếu hoặc chưa xác thực
- **COMPLIANCE**: Tuân thủ quy định
- **OPERATIONAL**: Vận hành (xe, container, v.v.)

---

## 9. PHÂN TÍCH & BÁO CÁO

### 9.1 Trang Analytics

- **Truy cập**: Sidebar → Analytics

### 9.2 Dữ liệu phân tích

| Biểu đồ | Dữ liệu | Nguồn |
|----------|----------|-------|
| Shipment theo loại | Phân bổ FCL vs AIR | Tất cả shipments |
| Shipment theo trạng thái | Phân bổ các trạng thái | Tất cả shipments |
| Shipment theo điểm đến | Top cảng đích | Tất cả shipments |
| Chi phí cước | Phân tích freight_rate_usd | Tất cả bookings |

---

## 10. CÀI ĐẶT

### 10.1 Giao diện

| Cài đặt | Mô tả |
|---------|-------|
| **Theme** | Dark / Light / System (tự động theo hệ thống) |
| **Accent Color** | Chọn màu nhấn tùy chỉnh (hex picker) |
| **Font Size** | Small / Medium / Large |
| **Density** | Compact / Comfortable / Spacious |

> **Lưu ý**: Theme và Accent Color được lưu vào `localStorage` và áp dụng **toàn app** khi khởi động (không chỉ trang Settings).

### 10.2 Hồ sơ người dùng

- Hiển thị tên, email, vai trò, phòng ban

---

## 11. QUẢN TRỊ (ADMIN)

### 11.1 Truy cập

- Chỉ tài khoản có `role = 'ADMIN'` mới thấy menu Admin
- **Truy cập**: Sidebar → Admin

### 11.2 Các chức năng

| Tab | Mô tả |
|-----|--------|
| **Users** | Quản lý người dùng (tạo, xem, sửa trạng thái) |
| **Licenses** | Quản lý license key, thiết bị kích hoạt |
| **Whitelist** | Quản lý danh sách thiết bị được truy cập admin |
| **Stats** | Thống kê hệ thống |

### 11.3 Tạo người dùng mới

1. Tab **Users** → **"Add User"**
2. Nhập: Email, Mật khẩu, Họ tên, Vai trò (ADMIN/MANAGER/STAFF), Phòng ban
3. Phân phối license key cho người dùng

---

## 12. TRỢ LÝ AI

### 12.1 Truy cập

- Sidebar → Assistant

### 12.2 Tính năng

- Chat với trợ lý AI về quy trình logistics
- **Lưu ý**: Phiên bản hiện tại sử dụng câu trả lời mô phỏng (placeholder)
- Phiên bản production sẽ tích hợp AI thực tế

---

## 13. QUY TRÌNH E2E HOÀN CHỈNH

### Tổng quan luồng dữ liệu

```
┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐
│   TẠO       │───▶│   XÁC NHẬN  │───▶│   TẠO       │───▶│   ĐIỀU      │
│   BOOKING   │    │   BOOKING   │    │   SHIPMENT  │    │   PHỐI XE   │
└─────────────┘    └─────────────┘    └──────┬──────┘    └─────────────┘
                                             │
                                      ┌──────▼──────┐    ┌─────────────┐
                                      │   UPLOAD    │───▶│   GIAO      │
                                      │   CHỨNG TỪ  │    │   HÀNG      │
                                      └─────────────┘    └─────────────┘
```

### Bước 1: Tạo Booking

1. Vào **Bookings** → **New Booking**
2. Chọn forwarder (phải tạo vendor trước)
3. Nhập thông tin tàu, cảng, deadline
4. Lưu → Trạng thái: `PENDING`

### Bước 2: Xác nhận Booking

1. Mở booking → **Confirm Booking**
2. Tự động tạo workflow tasks
3. Trạng thái: `CONFIRMED`

### Bước 3: Tạo Shipment liên kết

1. Vào **Shipments** → **New Shipment**
2. Mục **"Link to Booking"**: Chọn booking vừa tạo
3. Thông tin cảng tự động điền
4. Nhập mô tả hàng, trọng lượng, thể tích

### Bước 4: Điều phối xe

1. Vào **Logistics** → Tìm booking đã xác nhận
2. **Schedule Dispatch** → Nhập tài xế, xe, lịch trình
3. Dispatch tự động liên kết với booking và shipment

### Bước 5: Upload chứng từ

1. Mở **Shipment Detail** → Tab Documents
2. Upload Bill of Lading, Invoice, Packing List, CO
3. Hệ thống tự động phân loại chứng từ

### Bước 6: Theo dõi & Giao hàng

1. Cập nhật trạng thái shipment theo tiến trình:
   `PENDING` → `BOOKED` → `IN_TRANSIT` → `AT_PORT` → `IN_CUSTOMS` → `DELIVERED`
2. Dashboard tự động cập nhật số liệu

### Liên kết dữ liệu giữa các module

| Từ | Đến | Cách liên kết |
|----|-----|---------------|
| Vendor → Booking | `forwarder_id` | Khi tạo booking chọn vendor |
| Booking → Shipment | `shipment_id` | Khi tạo shipment chọn booking |
| Booking → Dispatch | `booking_id` | Khi tạo dispatch chọn booking |
| Shipment → Documents | `shipment_id` | Upload chứng từ cho shipment |
| Booking → Tasks | `booking_id` | Tự động khi confirm booking |
| Booking → Risk | Real-time | Tính từ deadline booking |
| Bookings → Analytics | Real-time | Tất cả dữ liệu booking thực |
| Bookings → Vendor Debt | SQL SUM | Tổng cước freight_rate_usd |

---

## TỔNG KẾT BUGS ĐÃ FIX

| # | Lỗi | Nguyên nhân | Trạng thái |
|---|------|-------------|-----------|
| 1 | Dashboard không hiện mã booking | Thiếu JOIN bảng bookings | ✅ Đã fix |
| 2 | Logistics hiện undefined toàn bộ | camelCase vs snake_case | ✅ Đã fix |
| 3 | Vendors có dữ liệu giả (Math.random) | Mock data trong code | ✅ Đã fix |
| 4 | Settings theme chỉ áp dụng trang Settings | Logic chỉ trong SettingsPage | ✅ Đã fix |
| 5 | Modal tạo Shipment chỉ hiện booking CONFIRMED | Filter status=CONFIRMED | ✅ Đã fix |
| 6 | Tạo Vendor bị thất bại | Field name mismatch | ✅ Đã fix |
| 7 | Login treo vô hạn khi server không phản hồi | Không có timeout | ✅ Đã fix |
| 8 | Tìm kiếm (Search) bị crash | MySQL syntax trong PostgreSQL | ✅ Đã fix |

---

> **Lưu ý khi sử dụng DMG**: Server backend phải chạy trên `localhost:3001` trước khi mở app. Chạy lệnh:
> ```bash
> cd [thư-mục-project]/server && npm run dev
> ```
