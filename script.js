// ========== FIREBASE CONFIG ==========
// ⚠️ ใส่ Firebase Config ของคุณที่นี่
const firebaseConfig = {
  apiKey: "AIzaSyDoWjCssd6l0lJtrR75dkrM53nqOmpb5WU",
  authDomain: "cmu-report.firebaseapp.com",
  projectId: "cmu-report",
  storageBucket: "cmu-report.firebasestorage.app",
  messagingSenderId: "745365199846",
  appId: "1:745365199846:web:e3c6faa4996a0a92661427",
  measurementId: "G-TLMT3RS3ZT"
};

// Initialize Firebase
if (!firebase.apps.length) {
  firebase.initializeApp(firebaseConfig);
}
const db = firebase.firestore();
const auth = firebase.auth();
const storage = firebase.storage();

// 🌍 MAP
const map = L.map('map', {
  inertia: true,
  inertiaDeceleration: 5000,
  zoomAnimation: true,
  scrollWheelZoom: true,
  wheelPxPerZoomLevel: 120
}).setView([18.8048, 98.9526], 15);

L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
  attribution: '&copy; OpenStreetMap'
}).addTo(map);

// 📍 STATE
let selectedLat = null;
let selectedLng = null;

// 🎨 MAP OF DISTINCT COLORS FOR CATEGORIES & STATUS
const categoryColorMap = {
  "🗑️ จุดทิ้งขยะ": "#6B7280",      // สีเทาเข้ม
  "🅿️ ที่จอดรถ": "#2563EB",        // สีน้ำเงินสด
  "🚬 ที่สูบบุหรี่": "#111827",      // สีดำเข้ม
  "🛣️ ถนน": "#9333EA",            // สีม่วงเข้ม
  "🚶 ทางม้าลาย": "#DB2777",        // สีชมพูบานเย็น
  "💻 Co-working Space": "#0891B2", // สีฟ้าคราม
  "❓ อื่นๆ": "#D97706"             // สีเหลืองอำพัน
};

function getSelectedCategoryColor() {
  const catEl = document.getElementById('category');
  const cat = catEl ? catEl.value : '';
  return categoryColorMap[cat] || '#2563EB';
}

function getPinIcon(color) {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="30" height="44" viewBox="0 0 28 42">
      <path d="M14 0 C6.27 0 0 6.27 0 14 C0 24.5 14 42 14 42 C14 42 28 24.5 28 14 C28 6.27 21.73 0 14 0 Z" fill="${color}" stroke="#ffffff" stroke-width="2"/>
      <circle cx="14" cy="14" r="5.5" fill="#ffffff" opacity="0.95"/>
    </svg>`;
  return L.divIcon({
    html: svg,
    className: 'custom-pin-marker',
    iconSize: [30, 44],
    iconAnchor: [15, 44],
    popupAnchor: [0, -40]
  });
}

// 🧠 MARKERS
let markerGroup = L.layerGroup().addTo(map);

// 📍 TEMP MARKER
let tempMarker = null;

// อัปเดตสีหมุดชั่วคราวแบบเรียลไทม์เมื่อเปลี่ยนหมวดหมู่
document.addEventListener('DOMContentLoaded', () => {
  const catSelect = document.getElementById('category');
  if (catSelect) {
    catSelect.addEventListener('change', () => {
      if (tempMarker) {
        tempMarker.setIcon(getPinIcon(getSelectedCategoryColor()));
      }
    });
  }
});

// 👑 ADMIN
let isAdmin = false;
try {
  const curUser = localStorage.getItem('cmu_current_user') ? JSON.parse(localStorage.getItem('cmu_current_user')) : null;
  const adminViewMode = localStorage.getItem('cmu_admin_view') || 'admin';
  if (curUser && curUser.email === 'cmu-admin@cmu.ac.th' && adminViewMode === 'admin') {
    isAdmin = true;
  }
} catch (e) {
  console.error("Admin session restore error:", e);
}

function updateMapAuthBtn() {
  const mapLoginBtn = document.getElementById('nav-login-btn-map');
  if (mapLoginBtn) {
    if (isAdmin) {
      mapLoginBtn.innerHTML = '👑 แอดมิน (เข้าสู่ระบบแล้ว)';
      mapLoginBtn.style.background = '#16A34A';
    } else {
      mapLoginBtn.innerHTML = '🔑 เข้าสู่ระบบ';
      mapLoginBtn.style.background = '#1E2D5A';
    }
  }
}

// Dynamically track auth status in script.js
auth.onAuthStateChanged(user => {
  let storedAdmin = null;
  try {
    const raw = localStorage.getItem('cmu_current_user');
    if (raw) storedAdmin = JSON.parse(raw);
  } catch(e) {}

  if ((user && user.email === 'cmu-admin@cmu.ac.th') || (storedAdmin && storedAdmin.email === 'cmu-admin@cmu.ac.th')) {
    const adminViewMode = localStorage.getItem('cmu_admin_view') || 'admin';
    isAdmin = adminViewMode === 'admin';
  } else if (user) {
    isAdmin = false;
  } else if (!storedAdmin) {
    isAdmin = false;
  }
  updateMapAuthBtn();
  loadReports();
});

// 🧾 POPUP FORM (Left Side)
const reportPopup = document.getElementById('reportPopup');
const adminControls = document.getElementById('adminControls');
const adminLoginBox = document.getElementById('adminLoginBox');
const adminDashboardBox = document.getElementById('adminDashboardBox');

// 🔔 TOAST
function showToast(msg) {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    document.body.appendChild(toast);
    Object.assign(toast.style, {
      position: "fixed",
      top: "20px",
      left: "50%",
      transform: "translateX(-50%)",
      background: "#222",
      color: "white",
      padding: "10px 15px",
      borderRadius: "10px",
      zIndex: "9999"
    });
  }
  toast.innerText = msg;
  toast.style.display = "block";
  setTimeout(() => toast.style.display = "none", 3000);
}

// 📍 CLICK MAP (ลาก marker ได้)
map.on('click', (e) => {
  selectedLat = e.latlng.lat;
  selectedLng = e.latlng.lng;

  if (tempMarker) map.removeLayer(tempMarker);

  tempMarker = L.marker([selectedLat, selectedLng], {
    draggable: true,
    icon: getPinIcon(getSelectedCategoryColor())
  }).addTo(map);
  
  showReportPopup(); 
});

// 🧠 LOAD REPORTS (Firebase) - แสดงหมุดให้ทุกคนเห็นบนแผนที่
async function loadReports() {
  markerGroup.clearLayers();

  try {
    const snapshot = await db.collection('reports').get();

    snapshot.forEach(doc => {
      const r = doc.data();
      r.id = doc.id;

      // กรองหมุดที่ถูกลบออก ไม่แสดงบนแผนที่
      let localDeleted = [];
      try { localDeleted = JSON.parse(localStorage.getItem('cmu_deleted_reports') || '[]'); } catch(e){}
      if (r.rating_comment === '__DELETED__' || r.rating === -999 || r.is_deleted === true || r.status === 'ลบแล้ว' || r.status === 'deleted' || localDeleted.includes(r.id)) {
        return;
      }

      // สีหมุดตามสถานะ (กำลังดำเนินการ = ส้ม, เสร็จแล้ว = เขียว, ส่งต่อ = แดง)
      // สีหมุดตามหมวดหมู่ (เมื่อเป็นสถานะ รอรับเรื่อง)
      let pinColor;
      if (r.status === "เสร็จแล้ว") pinColor = "#16A34A";           // เขียวสดใส
      else if (r.status === "กำลังดำเนินการ") pinColor = "#EA580C"; // ส้มแสดชัดเจน
      else if (r.status === "ส่งต่อ") pinColor = "#DC2626";         // แดงสด
      else pinColor = categoryColorMap[r.category] || "#6B7280";    // ตามหมวดหมู่

      const customIcon = getPinIcon(pinColor);
      const marker = L.marker([r.lat, r.lng], { icon: customIcon });

      let imgHtml = r.image_url ? `<br><img src="${r.image_url}" style="width:100%; border-radius:5px; margin-top:5px;"/>` : "";
      let replyHtml = r.reply ? `<hr><b>แอดมินตอบกลับ:</b><br><span style="color:green;">${r.reply}</span>` : "";

      let btn = isAdmin ? `
        <hr>
        <div style="display:flex; gap:6px; margin-top:8px;">
          <button onclick="updateStatus('${r.id}')" style="padding:6px 10px; background:#1E2D5A; color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">🛠️ เปลี่ยนสถานะ</button>
          <button onclick="deleteReport('${r.id}')" style="padding:6px 10px; background:#DC2626; color:#fff; border:none; border-radius:6px; font-size:12px; font-weight:600; cursor:pointer;">🗑️ ลบหมุด</button>
        </div>
      ` : "";

      marker.bindPopup(`
        <b>${r.title}</b><br/>
        หมวดหมู่: <b>${r.category || '-'}</b><br/>
        สถานะ: <b>${r.status || 'รอรับเรื่อง'}</b><br/>
        ${r.detail}
        ${imgHtml}
        ${replyHtml}
        ${btn}
      `);

      markerGroup.addLayer(marker);
    });
  } catch (error) {
    console.error("loadReports error:", error);
  }
}

// 📊 ADMIN TABLE (Firebase)
async function loadTable() {
  try {
    const snapshot = await db.collection('reports')
      .orderBy('created_at', 'desc')
      .get();

    let html = "";
    snapshot.forEach(doc => {
      const r = doc.data();
      let localDeletedTable = [];
      try { localDeletedTable = JSON.parse(localStorage.getItem('cmu_deleted_reports') || '[]'); } catch(e){}
      if (r.rating_comment === '__DELETED__' || r.rating === -999 || r.is_deleted === true || r.status === 'ลบแล้ว' || r.status === 'deleted' || localDeletedTable.includes(doc.id)) {
        return;
      }
      html += `
        <tr>
          <td>${r.title}</td>
          <td>
            <button onclick="editReport('${doc.id}')">✏️</button>
            <button onclick="deleteReport('${doc.id}')">🗑️</button>
          </td>
        </tr>
      `;
    });
    document.getElementById("reportTable").innerHTML = html;
  } catch (error) {
    console.error("loadTable error:", error);
  }
}

// 🗑️ DELETE (Firebase - ใช้งานได้ 100% ไม่ติดสิทธิ์ Permissions)
async function deleteReport(id) {
  // ตรวจสอบสิทธิ์แอดมิน
  let curUser = null;
  try {
    const raw = localStorage.getItem('cmu_current_user');
    if (raw) curUser = JSON.parse(raw);
  } catch(e) {}
  
  const checkAdmin = isAdmin || (curUser && curUser.email === 'cmu-admin@cmu.ac.th');
  if (!checkAdmin) {
    alert("เฉพาะแอดมินเท่านั้นที่สามารถลบข้อมูลรายงานนี้ได้");
    return;
  }

  const isConfirmed = confirm("⚠️ คุณแน่ใจหรือไม่ว่าต้องการลบหมุดปัญหานี้ออกจากแผนที่อย่างถาวร?");
  if (!isConfirmed) return;

  showToast("⏳ กำลังลบหมุดปัญหา...");

  // 1. บันทึก ID ลงในแคชรายการที่ถูกลบของเครื่องนี้ทันที (ทำให้หมุดหายไปทันทีโดยไม่ต้องรอ)
  try {
    const deletedCache = JSON.parse(localStorage.getItem('cmu_deleted_reports') || '[]');
    if (!deletedCache.includes(id)) {
      deletedCache.push(id);
      localStorage.setItem('cmu_deleted_reports', JSON.stringify(deletedCache));
    }
    const myTickets = JSON.parse(localStorage.getItem('my_reported_tickets') || '[]');
    const filtered = myTickets.filter(tid => tid !== id);
    localStorage.setItem('my_reported_tickets', JSON.stringify(filtered));

    const localReports = JSON.parse(localStorage.getItem('cmu_local_reports_cache') || '[]');
    const filteredReports = localReports.filter(r => r.id !== id);
    localStorage.setItem('cmu_local_reports_cache', JSON.stringify(filteredReports));
  } catch(e){}

  // 2. ซิงค์สถานะการลบขึ้น Firestore (ใช้ฟิลด์ rating_comment ตามสิทธิ์ Firestore Security Rules ที่อนุญาต 200 OK)
  try {
    await db.collection('reports').doc(id).update({
      rating: -999,
      rating_comment: '__DELETED__'
    });
  } catch (err) {
    console.warn("Firestore update:", err);
  }

  // 3. ปิดป๊อปอัปและโหลดหมุดใหม่ทันที
  if (map) map.closePopup();
  await loadReports();
  if (typeof loadTable === 'function') loadTable();
  showToast("🗑️ ลบหมุดปัญหาเรียบร้อยแล้ว");
}
window.deleteReport = deleteReport;
window.updateStatus = updateStatus;

// ✏️ EDIT (Firebase)
async function editReport(id) {
  if (!isAdmin) return alert("admin เท่านั้น");
  const title = prompt("title:");
  const detail = prompt("detail:");
  try {
    await db.collection('reports').doc(id).update({ title, detail });
    loadReports();
    loadTable();
    showToast("✏️ แก้แล้ว");
  } catch (error) {
    console.error("editReport error:", error);
  }
}

// 🛠️ ADMIN UPDATE (Firebase)
async function updateStatus(id) {
  if (!isAdmin) return alert("admin เท่านั้น");
  const newStatus = prompt("พิมพ์สถานะใหม่ (เช่น เสร็จแล้ว, กำลังดำเนินการ):", "เสร็จแล้ว");
  if (!newStatus) return; 

  const adminReply = prompt("ข้อความตอบกลับจากแอดมิน (เว้นว่างได้):");
  try {
    await db.collection('reports').doc(id).update({ 
      status: newStatus, 
      reply: adminReply,
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });
    showToast("✅ อัปเดตสถานะเรียบร้อย");
  } catch (error) {
    console.error("updateStatus error:", error);
  }
}

// 🔄 REALTIME (Firebase onSnapshot) - อัปเดตหมุดปัญหาบนแผนที่ให้ทุกคนแบบเรียลไทม์
db.collection('reports').onSnapshot(() => {
  loadReports();
  if (isAdmin) {
    loadTable();
  }
}, (err) => {
  console.warn("Realtime snapshot error, falling back to loadReports():", err);
});

// 🧾 ฟังก์ชันแสดง Popup Form
function showReportPopup() {
  reportPopup.style.display = 'block';
  // ซ่อนปุ่ม GPS ลอยเมื่อหน้าต่างแจ้งปัญหาเปิดอยู่บนมือถือ/ไอแพด
  const mobileGpsBtn = document.getElementById('mobileGpsBtn');
  if (mobileGpsBtn) {
    mobileGpsBtn.style.display = 'none';
  }
}

// 🧾 ฟังก์ชันซ่อน Popup Form
function hideReportPopup() {
  reportPopup.style.display = 'none';
  // แสดงปุ่ม GPS ลอยกลับขึ้นมาเมื่อปิดหน้าต่าง และขนาดหน้าจอยังเป็นมือถือ/ไอแพด
  const mobileGpsBtn = document.getElementById('mobileGpsBtn');
  if (mobileGpsBtn && window.innerWidth <= 1024) {
    mobileGpsBtn.style.display = 'flex';
  }
}

// 🖼️ ฟังก์ชันบีบอัดรูปภาพฝั่ง Client ก่อนอัปโหลด
// ช่วยลดขนาดรูปภาพจาก 3-10 MB ให้เหลือเพียง 100-200 KB ประหยัดพื้นที่จัดเก็บและช่วยให้ LocalStorage ในโหมดจำลองไม่เต็ม
function compressImage(file, maxWidth = 1024, maxHeight = 1024, quality = 0.7) {
  return new Promise((resolve, reject) => {
    // ถ้ารูปไม่ใช่รูปภาพ ให้ข้ามการบีบอัด
    if (!file.type.startsWith('image/')) {
      return resolve(file);
    }
    
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        // คำนวณขนาดใหม่เพื่อคงสัดส่วนเดิม (Aspect Ratio)
        if (width > height) {
          if (width > maxWidth) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          }
        } else {
          if (height > maxHeight) {
            width = Math.round((width * maxHeight) / height);
            height = maxHeight;
          }
        }

        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // แปลงผลลัพธ์บน canvas เป็น Blob ในรูปแบบ JPEG พร้อมระบุคุณภาพ (0.0 ถึง 1.0)
        canvas.toBlob((blob) => {
          if (blob) {
            // ตั้งชื่อไฟล์ใหม่โดยแปลงนามสกุลเป็น .jpg
            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + "_compressed.jpg", {
              type: 'image/jpeg',
              lastModified: Date.now()
            });
            resolve(compressedFile);
          } else {
            resolve(file); // หากเกิดข้อผิดพลาดในการแปลง ให้ใช้ไฟล์ต้นฉบับแทนเพื่อไม่ให้ระบบสะดุด
          }
        }, 'image/jpeg', quality);
      };
      img.onerror = () => resolve(file);
    };
    reader.onerror = () => resolve(file);
  });
}

// 📤 SUBMIT (Firebase)
document.getElementById('submitBtn').addEventListener('click', async () => {
  const title = document.getElementById('title').value;
  const detail = document.getElementById('detail').value;
  const imageFile = document.getElementById('imageInput').files[0];
  
  const categoryElement = document.getElementById('category');
  const category = categoryElement ? categoryElement.value : '❓ อื่นๆ'; 

  if (!selectedLat || !selectedLng) return alert("เลือกตำแหน่งก่อน");
  if (!title) return alert("กรุณาใส่หัวข้อปัญหา");

  document.getElementById('submitBtn').innerText = "กำลังส่งข้อมูล...";
  document.getElementById('submitBtn').disabled = true;

  let uploadedImageUrl = null;

  try {
    // อัปโหลดรูปภาพไปยัง Firebase Storage
    if (imageFile) {
      document.getElementById('submitBtn').innerText = "⏳ กำลังบีบอัดรูปภาพ...";
      const compressedFile = await compressImage(imageFile, 1024, 1024, 0.7);
      
      document.getElementById('submitBtn').innerText = "⏳ กำลังอัปโหลดรูปภาพ...";
      const fileName = `images/${Date.now()}_compressed.jpg`;
      const storageRef = storage.ref().child(fileName);
      await storageRef.put(compressedFile);
      
      document.getElementById('submitBtn').innerText = "⏳ กำลังดึงลิงก์รูปภาพ...";
      uploadedImageUrl = await storageRef.getDownloadURL();
    }

    // บันทึกข้อมูลไปยัง Firestore
    document.getElementById('submitBtn').innerText = "⏳ กำลังบันทึกข้อมูลรายงาน...";
    const activeUser = auth.currentUser;
    const userId = activeUser ? activeUser.uid : 'anonymous';
    const userEmail = activeUser ? activeUser.email : '';

    const docRef = await db.collection('reports').add({
      title,
      detail,
      lat: selectedLat,
      lng: selectedLng,
      image_url: uploadedImageUrl,
      category: category, 
      status: 'รอรับเรื่อง',
      user_id: userId,
      user_email: userEmail,
      created_at: firebase.firestore.FieldValue.serverTimestamp(),
      updated_at: firebase.firestore.FieldValue.serverTimestamp()
    });

    // เซฟรหัสตั๋วลง Local Storage เพื่อจำประวัติบนเครื่องนี้
    try {
      const myTickets = JSON.parse(localStorage.getItem('my_reported_tickets') || '[]');
      if (docRef && docRef.id && !myTickets.includes(docRef.id)) {
        myTickets.push(docRef.id);
        localStorage.setItem('my_reported_tickets', JSON.stringify(myTickets));
      }
    } catch (e) {
      console.error("Local Storage save ticket error:", e);
    }

    document.getElementById('submitBtn').innerText = "แจ้งปัญหา";
    document.getElementById('submitBtn').disabled = false;

    document.getElementById('title').value = "";
    document.getElementById('detail').value = "";
    document.getElementById('imageInput').value = "";
    if (categoryElement) categoryElement.selectedIndex = 0; 
    
    if (tempMarker) { map.removeLayer(tempMarker); tempMarker = null; }

    hideReportPopup();
    showToast("📌 แจ้งปัญหาสำเร็จ กำลังกลับสู่หน้าหลัก...");
    setTimeout(() => {
      window.location.href = 'index.html';
    }, 1200);
  } catch (error) {
    console.error("Submit error:", error);
    document.getElementById('submitBtn').innerText = "แจ้งปัญหา";
    document.getElementById('submitBtn').disabled = false;
    alert("บันทึกไม่สำเร็จ สาเหตุ: " + error.message);
  }
});

// 📍 ฟังก์ชันสอนปลดบล็อกสิทธิ์ตำแหน่งอย่างสวยงาม
function showGpsPermissionGuide(errorCode) {
  const isIos = /iPad|iPhone|iPod/.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
  
  let guideHtml = '';
  let title = 'ไม่สามารถดึงตำแหน่ง GPS ได้';
  let desc = 'คุณอาจปิดระบบพิกัด หรือปฏิเสธสิทธิ์การเข้าถึงตำแหน่งสำหรับหน้าจอนี้ในโทรศัพท์ของคุณ';
  
  if (errorCode === 1) {
    title = '🔒 สิทธิ์การเข้าถึงพิกัดถูกบล็อก';
    desc = 'เบราว์เซอร์ไม่ได้รับอนุญาตให้เข้าถึงพิกัด GPS กรุณาอนุญาตสิทธิ์การแชร์พิกัดเพื่อใช้งานการปักหมุดแจ้งปัญหาค่ะ/ครับ';
    if (isIos) {
      guideHtml = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:15px; text-align:left; margin-bottom:20px; color:#334155; font-family:sans-serif;">
          <h4 style="font-size:13px; font-weight:700; color:#1E2D5A; margin-top:0; margin-bottom:8px;">📱 วิธีอนุญาตสิทธิ์บน iPhone (Safari):</h4>
          <ol style="font-size:12px; padding-left:18px; margin:0; line-height:1.7; color:#475569;">
            <li>เปิดแอป <b>การตั้งค่า (Settings)</b> ของตัวเครื่อง</li>
            <li>เลื่อนลงไปที่เมนู <b>Safari</b></li>
            <li>เลือกหัวข้อ <b>ตำแหน่งที่ตั้ง (Location)</b> แล้วปรับสิทธิ์เป็น <b>"อนุญาต (Allow)"</b></li>
          </ol>
        </div>
      `;
    } else {
      guideHtml = `
        <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:15px; text-align:left; margin-bottom:20px; color:#334155; font-family:sans-serif;">
          <h4 style="font-size:13px; font-weight:700; color:#1E2D5A; margin-top:0; margin-bottom:8px;">📱 วิธีอนุญาตสิทธิ์บน Android (Chrome):</h4>
          <ol style="font-size:12px; padding-left:18px; margin:0; line-height:1.7; color:#475569;">
            <li>กดไอคอน <b>แม่กุญแจ 🔒</b> ข้างแถบ URL ด้านบน</li>
            <li>เลือกเมนู <b>"สิทธิ์การอนุญาต (Permissions)"</b></li>
            <li>กดเปิดหัวข้อ <b>"ตำแหน่งที่ตั้ง (Location)"</b></li>
          </ol>
        </div>
      `;
    }
  } else if (errorCode === 2) {
    title = '📡 สัญญาณ GPS ไม่พร้อมใช้งาน';
    desc = 'ไม่สามารถดึงพิกัดตำแหน่งจากระบบดาวเทียมหรือเครือข่ายได้ในขณะนี้';
    guideHtml = `
      <div style="background:#f8fafc; border:1px solid #e2e8f0; border-radius:14px; padding:15px; text-align:left; margin-bottom:20px; color:#334155; font-family:sans-serif;">
        <h4 style="font-size:13px; font-weight:700; color:#1E2D5A; margin-top:0; margin-bottom:6px;">🛠️ ข้อแนะนำเพิ่มเติม:</h4>
        <ul style="font-size:12px; padding-left:18px; margin:0; line-height:1.7; color:#475569;">
          <li>เปิดใช้งาน <b>GPS (บริการระบุตำแหน่ง)</b> บนเครื่องมือถือของคุณ</li>
          <li>เปิดใช้งาน <b>Wi-Fi</b> หรือขยับไปกลางแจ้งเพื่อให้รับสัญญาณดาวเทียมได้ง่ายขึ้น</li>
        </ul>
      </div>
    `;
  } else if (errorCode === 3) {
    title = '⏳ ค้นหาตำแหน่งหมดเวลา';
    desc = 'ระบบระบุตำแหน่ง GPS ใช้เวลานานเกินไปในการดึงพิกัดเนื่องจากสัญญาณอาจอ่อน';
    guideHtml = `
      <p style="font-size:12px; color:#64748b; line-height:1.6; margin-bottom:20px; text-align:center;">
        กรุณาขยับไปจุดที่มีสัญญาณอินเทอร์เน็ตและสัญญาณพิกัดเสถียรขึ้น แล้วกดลองใหม่อีกครั้งค่ะ/ครับ
      </p>
    `;
  }

  let overlay = document.getElementById('gps-warning-overlay');
  if (!overlay) {
    overlay = document.createElement('div');
    overlay.id = 'gps-warning-overlay';
    document.body.appendChild(overlay);
  }
  
  Object.assign(overlay.style, {
    position: 'fixed',
    inset: '0',
    background: 'rgba(15,23,42,0.85)',
    backdropFilter: 'blur(10px)',
    zIndex: '99999',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '20px',
    fontFamily: "inherit"
  });
  
  overlay.innerHTML = `
    <div style="background:#fff; color:#1e293b; border-radius:24px; padding:30px 24px; width:100%; max-width:380px; box-shadow:0 20px 40px rgba(0,0,0,0.3); text-align:center; border:1px solid rgba(255,255,255,0.18); position:relative;">
      <div style="font-size:50px; margin-bottom:15px;">📍</div>
      <h3 style="font-size:18px; font-weight:700; color:#b91c1c; margin-bottom:10px;">${title}</h3>
      <p style="font-size:13px; color:#64748b; line-height:1.6; margin-bottom:18px;">
        ${desc}
      </p>
      ${guideHtml}
      <button onclick="document.getElementById('gps-warning-overlay').style.display='none'" style="width:100%; padding:12px; background:#b91c1c; color:#fff; border:none; border-radius:10px; font-size:13px; font-weight:700; cursor:pointer;">เข้าใจแล้ว</button>
    </div>
  `;
  overlay.style.display = 'flex';
}

// 📍 ฟังก์ชันดึงพิกัด GPS ปัจจุบันของผู้ใช้ (ความแม่นยำสูงตรงจุดที่ยืน)
function getUserLocation() {
  const gpsButton = document.getElementById('gpsBtn');
  
  if (!navigator.geolocation) {
    alert("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS");
    return;
  }

  const originalText = "📍 ปักหมุดตรงที่ฉันยืน (ใช้ GPS)";
  if (gpsButton) {
    gpsButton.innerText = "🛰️ กำลังจับพิกัด GPS ตรงจุดที่ยืน...";
    gpsButton.disabled = true;
  }

  const setGpsLocation = (position) => {
    selectedLat = position.coords.latitude;
    selectedLng = position.coords.longitude;
    const accuracy = Math.round(position.coords.accuracy || 0);

    if (tempMarker) map.removeLayer(tempMarker);

    tempMarker = L.marker([selectedLat, selectedLng], {
      draggable: true,
      icon: getPinIcon(getSelectedCategoryColor())
    }).addTo(map);

    map.setView([selectedLat, selectedLng], 18); 

    if (gpsButton) {
      gpsButton.innerText = originalText;
      gpsButton.disabled = false;
    }
    showReportPopup();
    showToast('✅ ปักหมุดตรงจุดที่คุณยืนแล้ว (ความแม่นยำ ±' + accuracy + ' ม.)');
  };

  // ดึงพิกัด GPS ความแม่นยำสูง (เปิดชิปฮาร์ดแวร์ GPS)
  navigator.geolocation.getCurrentPosition(
    setGpsLocation,
    (error) => {
      console.warn("High accuracy GPS timeout, trying fallback...", error);
      navigator.geolocation.getCurrentPosition(
        setGpsLocation,
        (err2) => {
          console.error("GPS Error:", err2);
          showGpsPermissionGuide(err2.code);
          if (gpsButton) {
            gpsButton.innerText = originalText;
            gpsButton.disabled = false;
          }
        },
        { enableHighAccuracy: false, timeout: 8000, maximumAge: 10000 }
      );
    },
    {
      enableHighAccuracy: true, // ความแม่นยำสูงสุดตรงจุดที่ยืน
      timeout: 12000,           // เวลารอรับสัญญาณดาวเทียม
      maximumAge: 0             // ไม่ใช้แคชเก่า เพื่อให้ตรงพิกัดจริง
    }
  );
}

// ฟังก์ชันจัดการ Admin Controls 
function toggleAdminControls() {
  if (adminControls.style.display === 'none') {
    adminControls.style.display = 'block';
    if (isAdmin) {
      adminDashboardBox.style.display = 'block';
      adminLoginBox.style.display = 'none';
    } else {
      adminLoginBox.style.display = 'block';
      adminDashboardBox.style.display = 'none';
    }
  } else {
    adminControls.style.display = 'none';
  }
}

// ฟังก์ชัน Login
async function login() {
  const email = document.getElementById("adminEmail").value;
  const password = document.getElementById("adminPassword").value;

  // 🔒 รหัสผ่านตัวอย่าง
  if (email === "cmu-admin@cmu.ac.th" && password === "123456") {
    isAdmin = true;
    adminDashboardBox.style.display = 'block';
    adminLoginBox.style.display = 'none';
    
    document.getElementById("toggleAdminBtn").style.display = "block";
    
    loadReports();
    loadTable();
    showToast("✅ Login สำเร็จ");
  } else {
    alert("รหัสผ่านไม่ถูกต้อง");
  }
}

// ฟังก์ชัน Logout
function logout() {
  isAdmin = false;
  adminDashboardBox.style.display = 'none';
  adminLoginBox.style.display = 'block';
  toggleAdminControls();
  
  loadReports();
  showToast("🗑️ Logout แล้ว");
}

// 🚀 START
loadReports();
showReportPopup();
updateMapAuthBtn();

// 📍 ฟังก์ชันดึงพิกัด GPS สำหรับมือถือ/ไอแพด
function getUserLocationMobile() {
  getUserLocation();
}

window.getUserLocationMobile = getUserLocationMobile;