// ========== CMU REPORT LOCAL STORAGE & MOCK FIREBASE SDK ==========
// Mock Firebase using browser's Local Storage so the app runs instantly 
// offline or online without database rules or server limits.

const MOCK_REPORTS_KEY = 'cmu_reports';
const MOCK_USERS_KEY = 'cmu_users';
const MOCK_CURRENT_USER_KEY = 'cmu_current_user';

// Global listener arrays for cross-instance and cross-tab synchronization
const firestoreListeners = [];
const authListeners = [];

// Init default reports in Local Storage if empty
const initDefaultReports = () => {
  const current = localStorage.getItem(MOCK_REPORTS_KEY);
  if (!current) {
    const defaultData = [
      {
        id: 'mock_1',
        title: 'ไฟกิ่งทางเดินอ่างแก้วดับ',
        detail: 'เสาไฟฟ้ากิ่งต้นที่ 3 นับจากทางเข้าอ่างแก้วฝั่งขวา หลอดไฟขาด ดับสนิทตอนกลางคืน ทำให้ทางเดินค่อนข้างมืดและเป็นอันตราย',
        lat: 18.8062,
        lng: 98.9535,
        image_url: 'https://images.unsplash.com/photo-1517486808906-6ca8b3f04846?auto=format&fit=crop&w=400&q=80',
        category: '💡 ไฟฟ้า / หลอดไฟ',
        status: 'เสร็จแล้ว',
        reply: 'ทีมงานได้ทำการเปลี่ยนหลอดไฟกิ่งดวงใหม่ขนาด 50W เรียบร้อยแล้วครับ ขอบคุณที่แจ้งปัญหาครับ',
        created_at: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'mock_2',
        title: 'แอร์ห้องเรียน 301 ไม่เย็น',
        detail: 'แอร์ที่ฝั่งหลังห้องเรียน SCB1301 คณะวิทยาศาสตร์ มีแต่ลมออกแต่ไม่มีความเย็น และมีเสียงดังผิดปกติรบกวนสมาธิขณะเรียน',
        lat: 18.8028,
        lng: 98.9515,
        image_url: 'https://images.unsplash.com/photo-1527689368864-3a821dbccc34?auto=format&fit=crop&w=400&q=80',
        category: '🏢 อาคาร / แอร์ห้องเรียน',
        status: 'กำลังดำเนินการ',
        reply: 'ช่างเครื่องเย็นได้รับเรื่องแล้ว กำลังตรวจสอบระบบพัดลมคอยล์ร้อนและระดับน้ำยาแอร์ คาดว่าจะเสร็จสิ้นในวันนี้',
        created_at: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 6 * 60 * 60 * 1000).toISOString()
      },
      {
        id: 'mock_3',
        title: 'ท่อประปาหน้าคณะวิศวะรั่ว',
        detail: 'พบบริเวณสนามหญ้าด้านหน้าอาคาร 3 คณะวิศวกรรมศาสตร์ มีน้ำไหลเอ่อซึมขึ้นมาจากใต้ดินตลอดเวลา คาดว่าท่อน้ำประปาใต้ดินรั่ว',
        lat: 18.7995,
        lng: 98.9498,
        image_url: '',
        category: '💧 ห้องน้ำ / ท่อประปา',
        status: 'รอรับเรื่อง',
        reply: '',
        created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString(),
        updated_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
      }
    ];
    localStorage.setItem(MOCK_REPORTS_KEY, JSON.stringify(defaultData));
  }
};

const initDefaultUsers = () => {
  const current = localStorage.getItem(MOCK_USERS_KEY);
  let users = current ? JSON.parse(current) : [];
  
  const hasAdmin = users.some(u => u.email === 'cmu-admin@cmu.ac.th');
  const hasStudent = users.some(u => u.email === 'student@cmu.ac.th');
  
  let modified = false;
  if (!hasAdmin) {
    users.push({
      uid: 'admin_123',
      email: 'cmu-admin@cmu.ac.th',
      password: '123456'
    });
    modified = true;
  }
  if (!hasStudent) {
    users.push({
      uid: 'student_123',
      email: 'student@cmu.ac.th',
      password: '123456'
    });
    modified = true;
  }
  
  if (modified || !current) {
    localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
  }
};

initDefaultReports();
initDefaultUsers();

// global firebase mock object
window.firebase = {
  apps: [{ name: '[MockFirebase]' }],
  
  initializeApp: function(config) {
    console.log('⚡ Mock Firebase initialized using Local Storage!');
    return this;
  },
  
  // 🧠 FIRESTORE MOCK
  firestore: function() {
    const getReports = () => {
      const data = localStorage.getItem(MOCK_REPORTS_KEY);
      return data ? JSON.parse(data) : [];
    };
    
    const saveReports = (reports) => {
      localStorage.setItem(MOCK_REPORTS_KEY, JSON.stringify(reports));
      // Notify active snapshot listeners
      setTimeout(() => {
        firestoreListeners.forEach(cb => {
          try { cb(); } catch (err) { console.error(err); }
        });
      }, 50);
    };
    

    
    const db = {
      collection: function(colName) {
        let filters = [];
        let sortField = null;
        let sortDir = 'asc';
        
        const chain = {
          where: function(field, op, val) {
            filters.push({ field, op, val });
            return this;
          },
          orderBy: function(field, direction = 'asc') {
            sortField = field;
            sortDir = direction;
            return this;
          },
          get: async function() {
            let list = getReports();
            
            // apply local filters
            filters.forEach(f => {
              if (f.op === '==') {
                list = list.filter(item => item[f.field] === f.val);
              }
            });
            
            // apply sorting
            if (sortField) {
              list.sort((a, b) => {
                const valA = a[sortField] || '';
                const valB = b[sortField] || '';
                if (sortDir === 'desc') {
                  return valB > valA ? 1 : valB < valA ? -1 : 0;
                } else {
                  return valA > valB ? 1 : valA < valB ? -1 : 0;
                }
              });
            }
            
            const docs = list.map(item => ({
              id: item.id,
              data: () => ({
                ...item,
                // Simulate Firestore Timestamp conversion
                created_at: item.created_at ? { toDate: () => new Date(item.created_at) } : null,
                updated_at: item.updated_at ? { toDate: () => new Date(item.updated_at) } : null
              })
            }));
            
            return {
              forEach: function(callback) {
                docs.forEach(callback);
              },
              docs: docs,
              size: docs.length
            };
          },
          add: async function(data) {
            const list = getReports();
            const newDoc = {
              ...data,
              id: 'rep_' + Math.random().toString(36).substr(2, 9),
              created_at: data.created_at || new Date().toISOString(),
              updated_at: data.updated_at || new Date().toISOString()
            };
            list.push(newDoc);
            saveReports(list);
            return { id: newDoc.id };
          },
          doc: function(docId) {
            return {
              update: async function(updateData) {
                const list = getReports();
                const idx = list.findIndex(item => item.id === docId);
                if (idx !== -1) {
                  // clean up field value placeholders
                  const cleanUpdate = { ...updateData };
                  delete cleanUpdate.updated_at; // handles serverTimestamp
                  
                  list[idx] = {
                    ...list[idx],
                    ...cleanUpdate,
                    updated_at: new Date().toISOString()
                  };
                  saveReports(list);
                }
              },
              delete: async function() {
                const list = getReports();
                const filtered = list.filter(item => item.id !== docId);
                saveReports(filtered);
              }
            };
          },
          onSnapshot: function(callback) {
            firestoreListeners.push(callback);
            // Run callback immediately on registry
            setTimeout(() => callback(), 10);
            return () => {
              const idx = firestoreListeners.indexOf(callback);
              if (idx !== -1) firestoreListeners.splice(idx, 1);
            };
          }
        };
        return chain;
      },
      FieldValue: {
        serverTimestamp: () => new Date().toISOString()
      }
    };
    return db;
  },
  
  // 🔑 AUTH MOCK
  auth: function() {
    const getUsers = () => {
      const data = localStorage.getItem(MOCK_USERS_KEY);
      return data ? JSON.parse(data) : [];
    };
    
    const saveUsers = (users) => {
      localStorage.setItem(MOCK_USERS_KEY, JSON.stringify(users));
    };
    
    const getCurrentUser = () => {
      const data = localStorage.getItem(MOCK_CURRENT_USER_KEY);
      return data ? JSON.parse(data) : null;
    };
    
    const setCurrentUser = (user) => {
      if (user) {
        localStorage.setItem(MOCK_CURRENT_USER_KEY, JSON.stringify(user));
      } else {
        localStorage.removeItem(MOCK_CURRENT_USER_KEY);
      }
      setTimeout(() => {
        authListeners.forEach(cb => {
          try { cb(user); } catch (err) { console.error(err); }
        });
      }, 50);
    };
    

    
    const authService = {
      get currentUser() {
        return getCurrentUser();
      },
      onAuthStateChanged: function(callback) {
        authListeners.push(callback);
        // callback with current state immediately
        const user = getCurrentUser();
        setTimeout(() => callback(user), 10);
        return () => {
          const idx = authListeners.indexOf(callback);
          if (idx !== -1) authListeners.splice(idx, 1);
        };
      },
      
      signInWithEmailAndPassword: async function(email, password) {
        const users = getUsers();
        const found = users.find(u => u.email.toLowerCase() === email.toLowerCase() && u.password === password);
        if (!found) {
          throw { code: 'auth/wrong-password', message: 'อีเมลหรือรหัสผ่านไม่ถูกต้อง' };
        }
        
        const loggedUser = {
          uid: found.uid,
          email: found.email,
          displayName: found.email.split('@')[0]
        };
        setCurrentUser(loggedUser);
        return { user: loggedUser };
      },
      
      createUserWithEmailAndPassword: async function(email, password) {
        const users = getUsers();
        const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (exists) {
          throw { code: 'auth/email-already-in-use', message: 'อีเมลนี้ถูกใช้งานแล้วในระบบ' };
        }
        
        const newUser = {
          uid: 'usr_' + Math.random().toString(36).substr(2, 9),
          email: email,
          password: password
        };
        
        users.push(newUser);
        saveUsers(users);
        
        const loggedUser = {
          uid: newUser.uid,
          email: newUser.email,
          displayName: newUser.email.split('@')[0]
        };
        setCurrentUser(loggedUser);
        return { user: loggedUser };
      },
      
      signInWithPopup: async function(provider) {
        // Mock Google sign-in details
        const email = 'cmu.student@cmu.ac.th';
        const loggedUser = {
          uid: 'google_' + Math.random().toString(36).substr(2, 9),
          email: email,
          displayName: 'CMU Student (Google)'
        };
        setCurrentUser(loggedUser);
        return { user: loggedUser };
      },
      
      signOut: async function() {
        setCurrentUser(null);
        return true;
      },
      
      sendPasswordResetEmail: async function(email) {
        const users = getUsers();
        const exists = users.some(u => u.email.toLowerCase() === email.toLowerCase());
        if (!exists) {
          throw { code: 'auth/user-not-found', message: 'ไม่พบผู้ใช้ที่ใช้อีเมลนี้' };
        }
        console.log(`✉️ Mock password reset link sent to: ${email}`);
        return true;
      },
      
      GoogleAuthProvider: class {
        constructor() {
          this.providerId = 'google.com';
        }
        setCustomParameters() {}
      }
    };
    
    return authService;
  },
  
  // 📁 STORAGE MOCK (Converts images to LocalStorage base64 data URLs)
  storage: function() {
    return {
      ref: function() {
        return {
          child: function(filePath) {
            let activeFile = null;
            return {
              put: async function(file) {
                activeFile = file;
                return { state: 'success' };
              },
              getDownloadURL: async function() {
                if (!activeFile) {
                  return '';
                }
                // Convert file blob/file to Base64 so it can be saved locally in localStorage
                return new Promise((resolve, reject) => {
                  const reader = new FileReader();
                  reader.onloadend = () => {
                    resolve(reader.result);
                  };
                  reader.onerror = (err) => {
                    reject(err);
                  };
                  reader.readAsDataURL(activeFile);
                });
              }
            };
          }
        };
      }
    };
  }
};

// Attach static members to Mock functions to match Firebase API exactly
window.firebase.firestore.FieldValue = {
  serverTimestamp: () => new Date().toISOString()
};

window.firebase.auth.GoogleAuthProvider = class {
  constructor() {
    this.providerId = 'google.com';
  }
  setCustomParameters() {}
};

// Cross-tab real-time database and auth synchronization
window.addEventListener('storage', (e) => {
  if (e.key === MOCK_REPORTS_KEY) {
    firestoreListeners.forEach(cb => {
      try { cb(); } catch (err) { console.error(err); }
    });
  }
  if (e.key === MOCK_CURRENT_USER_KEY) {
    const user = e.newValue ? JSON.parse(e.newValue) : null;
    authListeners.forEach(cb => {
      try { cb(user); } catch (err) { console.error(err); }
    });
  }
});
