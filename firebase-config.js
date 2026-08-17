var firebaseConfig = {
  apiKey: "AIzaSyCw•••••••••••••••••••••••••••••••",
  authDomain: "wifi-gps-compare.firebaseapp.com",
  projectId: "wifi-gps-compare",
  storageBucket: "wifi-gps-compare.firebasestorage.app",
  messagingSenderId: "901536471405",
  appId: "1:901536471405:web:b228ecfcd546e6e8b26264"
};
if (typeof firebaseConfig === "undefined") {
    console.error("firebase-config.js 尚未載入，請確認 <script> 順序。");
}
/*
apiKey	識別這個 App 的金鑰（不是機密，前端本來就看得到，靠 Firestore 安全規則把關，不是靠藏這把 key）
authDomain	Firebase Authentication 用的網域（如果你之後有加登入功能才會用到）
projectId	專案 ID，跟 .firebaserc 裡那個要一致
storageBucket	Firebase Storage（雲端檔案儲存）的位置，目前程式碼沒用到這個功能，但欄位還是要留著
messagingSenderId / appId	推播（FCM）跟 App 識別用，firebase-push.js 會用到
*/