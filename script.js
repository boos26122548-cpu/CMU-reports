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

// ไอคอนสีน้ำเงินสำหรับปักหมุดชั่วคราว (แก้บั๊ก Leaflet หาไฟล์รูปหมุดเริ่มต้นไม่เจอในมือถือ/iPad)
const blueIcon = L.icon({
  iconUrl: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-blue.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41]
});

// 🧠 MARKERS
let markerGroup = L.layerGroup().addTo(map);

// 📍 TEMP MARKER
let tempMarker = null;

// 👑 ADMIN
let isAdmin = false;
try {
  const curUser = localStorage.getItem('cmu_current_user') ? JSON.parse(localStorage.getItem('cmu_current_user')) : null;
  if (curUser && curUser.email === 'cmu-admin@cmu.ac.th') {
    isAdmin = true;
  }
} catch (e) {
  console.error("Admin session restore error:", e);
}

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
    icon: blueIcon
  }).addTo(map);
  
  showReportPopup(); 
});

// 🧠 LOAD REPORTS (Firebase)
async function loadReports() {
  markerGroup.clearLayers();

  // 👑 ตรวจสอบว่าเป็นแอดมินหรือไม่ หากไม่ใช่แอดมิน ไม่ต้องโหลดหมุด
  if (!isAdmin) {
    return;
  }

  try {
    const snapshot = await db.collection('reports').get();

    snapshot.forEach(doc => {
      const r = doc.data();
      r.id = doc.id;

      let markerColor = "red"; 
      if (r.status === "เสร็จแล้ว") markerColor = "green";
      else if (r.status === "กำลังดำเนินการ") markerColor = "orange";

      const customIcon = L.icon({
        iconUrl: `https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-${markerColor}.png`,
        shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/0.7.7/images/marker-shadow.png',
        iconSize: [25, 41],       
        iconAnchor: [12, 41],     
        popupAnchor: [1, -34],    
        shadowSize: [41, 41]      
      });

      const marker = L.marker([r.lat, r.lng], { icon: customIcon });

      let imgHtml = r.image_url ? `<br><img src="${r.image_url}" style="width:100%; border-radius:5px; margin-top:5px;"/>` : "";
      let replyHtml = r.reply ? `<hr><b>แอดมินตอบกลับ:</b><br><span style="color:green;">${r.reply}</span>` : "";

      let btn = isAdmin ? `
        <hr>
        <button onclick="updateStatus('${r.id}')">🛠️ เปลี่ยนสถานะ</button>
        <button onclick="deleteReport('${r.id}')">🗑️ ลบ</button>
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

// 🗑️ DELETE (Firebase)
async function deleteReport(id) {
  if (!isAdmin) return alert("admin เท่านั้น");
  try {
    await db.collection('reports').doc(id).delete();
    loadReports();
    loadTable();
    showToast("🗑️ ลบแล้ว");
  } catch (error) {
    console.error("deleteReport error:", error);
  }
}

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

// 🔄 REALTIME (Firebase onSnapshot)
db.collection('reports').onSnapshot(() => {
  if (isAdmin) {
    loadReports();
    loadTable();
  }
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
      const fileName = `images/${Date.now()}_${imageFile.name}`;
      const storageRef = storage.ref().child(fileName);
      await storageRef.put(imageFile);
      uploadedImageUrl = await storageRef.getDownloadURL();
    }

    // บันทึกข้อมูลไปยัง Firestore
    const activeUser = auth.currentUser;
    const userId = activeUser ? activeUser.uid : 'anonymous';
    const userEmail = activeUser ? activeUser.email : '';

    await db.collection('reports').add({
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
      window.location.href = 'cmu-report-final9.html';
    }, 1200);
  } catch (error) {
    console.error("Submit error:", error);
    document.getElementById('submitBtn').innerText = "แจ้งปัญหา";
    document.getElementById('submitBtn').disabled = false;
    alert("บันทึกไม่สำเร็จ สาเหตุ: " + error.message);
  }
});

// 📍 ฟังก์ชันดึงพิกัด GPS ปัจจุบันของผู้ใช้
function getUserLocation() {
  const gpsButton = document.getElementById('gpsBtn');
  
  if (!navigator.geolocation) {
    alert("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS");
    return;
  }

  gpsButton.innerText = "⏳ กำลังค้นหาตำแหน่ง...";
  gpsButton.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      selectedLat = position.coords.latitude;
      selectedLng = position.coords.longitude;

      if (tempMarker) map.removeLayer(tempMarker);

      tempMarker = L.marker([selectedLat, selectedLng], {
        draggable: true,
        icon: blueIcon
      }).addTo(map);

      map.setView([selectedLat, selectedLng], 17); 

      gpsButton.innerText = "📍 ใช้ตำแหน่งปัจจุบันของฉัน";
      gpsButton.disabled = false;
      showReportPopup();
      showToast("✅ ปักหมุดตามพิกัด GPS สำเร็จ");
    },
    (error) => {
      console.error("GPS Error:", error);
      alert("ไม่สามารถเข้าถึง GPS ได้ กรุณาอนุญาตเปิดสิทธิ์เข้าถึงตำแหน่งบนเบราว์เซอร์");
      gpsButton.innerText = "📍 ใช้ตำแหน่งปัจจุบันของฉัน";
      gpsButton.disabled = false;
    },
    {
      enableHighAccuracy: false, 
      timeout: 10000,            
      maximumAge: 0             
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

// 📍 ฟังก์ชันดึงพิกัด GPS สำหรับมือถือ/ไอแพด (ปุ่มลอยซ้ายล่าง)
function getUserLocationMobile() {
  const mobileGpsBtn = document.getElementById('mobileGpsBtn');
  
  if (!navigator.geolocation) {
    alert("เบราว์เซอร์ของคุณไม่รองรับการดึงพิกัด GPS");
    return;
  }

  const originalHtml = mobileGpsBtn.innerHTML;
  mobileGpsBtn.innerHTML = "⏳ กำลังค้นหาตำแหน่ง...";
  mobileGpsBtn.disabled = true;

  navigator.geolocation.getCurrentPosition(
    (position) => {
      selectedLat = position.coords.latitude;
      selectedLng = position.coords.longitude;

      if (tempMarker) map.removeLayer(tempMarker);

      tempMarker = L.marker([selectedLat, selectedLng], {
        draggable: true,
        icon: blueIcon
      }).addTo(map);

      map.setView([selectedLat, selectedLng], 17); 

      mobileGpsBtn.innerHTML = originalHtml;
      mobileGpsBtn.disabled = false;
      showReportPopup();
      showToast("✅ ปักหมุดตามพิกัด GPS สำเร็จ");
    },
    (error) => {
      console.error("GPS Error:", error);
      alert("ไม่สามารถเข้าถึง GPS ได้ กรุณาอนุญาตเปิดสิทธิ์เข้าถึงตำแหน่งบนเบราว์เซอร์");
      mobileGpsBtn.innerHTML = originalHtml;
      mobileGpsBtn.disabled = false;
    },
    {
      enableHighAccuracy: false, 
      timeout: 10000,            
      maximumAge: 0             
    }
  );
}

window.getUserLocationMobile = getUserLocationMobile;