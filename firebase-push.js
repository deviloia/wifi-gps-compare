var firebaseMessaging = null;
var currentFirebaseToken = "";
var firebaseMessagingError = "";
//輔助判斷函式
function getFirebaseServiceWorkerUrl() {
    return new URL("firebase-messaging-sw.js", window.location.href).pathname;
}

function isPushFeatureAvailable() {
    return "Notification" in window &&
        "serviceWorker" in navigator &&
        "PushManager" in window;
}

function initializeFirebaseMessaging() {//初始化推播服務
    if (firebaseMessaging || typeof firebase === "undefined" || !firebase.messaging) {
        return;
    }

    if (!isPushFeatureAvailable()) {
        firebaseMessagingError = "瀏覽器缺少 Notification / Service Worker / PushManager。";
        return;
    }

    if (!firebase.apps.length) {
        firebase.initializeApp(firebaseConfig);
    }

    try {
        firebaseMessaging = firebase.messaging();
        firebaseMessaging.onMessage(handleForegroundMessage);
        firebaseMessagingError = "";
    } catch (error) {
        firebaseMessaging = null;
        firebaseMessagingError = getErrorMessage(error);
        console.warn("Firebase Messaging 初始化失敗", error);
    }
}

function enableFirebasePush() {
    var button = document.getElementById("pushButton");

    if (!("Notification" in window)) {
        setPushStatus("這個瀏覽器不支援通知。", "error");
        return;
    }

    if (!("serviceWorker" in navigator)) {
        setPushStatus("這個瀏覽器不支援 Service Worker，無法使用 Firebase 推播。", "error");
        return;
    }

    if (!("PushManager" in window)) {
        setPushStatus("這個瀏覽器不支援 Web Push。", "error");
        return;
    }

    initializeFirebaseMessaging();

    if (!firebaseMessaging) {
        setPushStatus("Firebase Messaging 載入失敗：" + (firebaseMessagingError || "請重新整理後再試。"), "error");
        updatePushDebug();
        return;
    }

    button.disabled = true;
    button.textContent = "啟用中...";
    setPushStatus("正在註冊 Service Worker 並要求通知權限...", "warning");
    updatePushDebug();

    navigator.serviceWorker.register(getFirebaseServiceWorkerUrl())
        .then(function(registration) {
            return registration.update()
                .catch(function() {
                    return null;
                })
                .then(function() {
                    return registration;
                });
        })
        .then(function(registration) {
            return Notification.requestPermission()
                .then(function(permission) {
                    return {
                        permission: permission,
                        registration: registration
                    };
                });
        })
        .then(function(result) {
            var permission = result.permission;
            var registration = result.registration;

            if (permission !== "granted") {
                throw new Error("通知權限未允許，無法啟用推播。");
            }

            return firebaseMessaging.getToken({
                vapidKey: firebaseVapidKey,
                serviceWorkerRegistration: registration
            });
        })
        .then(function(token) {
            if (!token) {
                throw new Error("沒有取得 FCM token，請確認瀏覽器允許通知。");
            }

            showFirebaseToken(token);
            setPushStatus("Firebase 推播已啟用。需要測試時按「複製 Token」，貼到 Firebase Console 的測試裝置欄位。", "success");
            updatePushDebug();
        })
        .catch(function(error) {
            setPushStatus(getErrorMessage(error) || "啟用 Firebase 推播失敗。", "error");
            updatePushDebug();
        })
        .finally(function() {
            button.disabled = false;
            button.textContent = "重新取得 Firebase 推播 Token";
        });
}

function handleForegroundMessage(payload) {
    var notification = payload.notification || {};
    var title = notification.title || "元智校園推播系統";
    var body = notification.body || "你收到一則前景推播。";

    setPushStatus("收到前景推播：" + title + " - " + body, "success");
    showPushMessage(title, body, "Firebase 前景推播");
    addPushMessageToNotificationLog(title, body, "Firebase 前景推播");

    if (Notification.permission === "granted") {
        navigator.serviceWorker.getRegistration(getFirebaseServiceWorkerUrl())
            .then(function(registration) {
                if (registration) {
                    return registration.showNotification(title, {
                        body: body,
                        tag: "firebase-foreground-message",
                        data: {
                            url: window.location.href
                        }
                    });
                }

                new Notification(title, { body: body });
            });
    }
}

function showFirebaseToken(token) {
    var tokenBox = document.getElementById("pushTokenBox");
    var tokenEl = document.getElementById("pushToken");

    currentFirebaseToken = token;
    tokenEl.textContent = "Token 已儲存。請按「複製 Token」貼到 Firebase Console 測試裝置欄位。";
    tokenBox.style.display = "block";
}

function setPushStatus(message, type) {
    var el = document.getElementById("pushStatus");

    if (!el) {
        return;
    }

    el.innerHTML = message ? '<p class="' + type + '">' + message + "</p>" : "";
}

function copyFirebaseToken() {  
    if (!currentFirebaseToken) {
        setPushStatus("目前還沒有 token，請先按「開啟 Firebase 推播」。", "warning");
        return;
    }

    navigator.clipboard.writeText(currentFirebaseToken)
        .then(function() {
            setPushStatus("Token 已複製，可以貼到 Firebase Console 的測試訊息欄位。", "success");
        })
        .catch(function() {
            setPushStatus("複製失敗，請手動反白 token 後複製。", "error");
        });
}//Token = 這台裝置的專屬推播地址。沒有它，Firebase 伺服器完全不知道要把通知送去哪一台手機；有了它，才能做到「精準推播給特定的人」，而不是廣播給所有人

function sendLocalTestNotification() {
    if (!("Notification" in window)) {
        setPushStatus("這個瀏覽器不支援通知。", "error");
        return;
    }

    if (!("serviceWorker" in navigator)) {
        setPushStatus("這個瀏覽器不支援 Service Worker，無法測試推播通知。", "error");
        return;
    }

    Notification.requestPermission()
        .then(function(permission) {
            updatePushDebug();

            if (permission !== "granted") {
                throw new Error("通知權限未允許，所以本機通知也不會顯示。");
            }

            return navigator.serviceWorker.register(getFirebaseServiceWorkerUrl());
        })
        .then(function(registration) {
            return registration.showNotification("通知權限測試", {
                body: "這只是確認瀏覽器能跳通知，不是 Firebase Console 的推播內容。",
                tag: "local-service-worker-test",
                renotify: true,
                data: {
                    url: window.location.href
                }
            });
        })
        .then(function() {
            setPushStatus("已送出通知權限測試。這則不會寫入推播內容，Firebase Console 送出的訊息才會顯示在下方。", "success");
            updatePushDebug();
        })
        .catch(function(error) {
            setPushStatus(getErrorMessage(error), "error");
        });
}

function sendDirectNotification() {
    var titleInput = document.getElementById("directPushTitle");
    var bodyInput = document.getElementById("directPushBody");
    var title = titleInput && titleInput.value.trim() ? titleInput.value.trim() : "設施回報通知";
    var body = bodyInput && bodyInput.value.trim() ? bodyInput.value.trim() : "有人回報校園設施需要處理。";

    if (!("Notification" in window)) {
        setPushStatus("這個瀏覽器不支援通知。", "error");
        return;
    }

    if (!("serviceWorker" in navigator)) {
        setPushStatus("這個瀏覽器不支援 Service Worker，無法直接彈出通知。", "error");
        return;
    }

    Notification.requestPermission()
        .then(function(permission) {
            if (permission !== "granted") {
                throw new Error("通知權限未允許，所以通知不會顯示。");
            }

            return navigator.serviceWorker.register(getFirebaseServiceWorkerUrl());
        })
        .then(function(registration) {
            showPushMessage(title, body, "直接測試");
            addPushMessageToNotificationLog(title, body, "直接測試");

            return registration.showNotification(title, {
                body: body,
                tag: "direct-push-preview",
                renotify: true,
                data: {
                    url: window.location.href
                }
            });
        })
        .then(function() {
            setPushStatus("已直接彈出你輸入的通知內容。這是本機預覽，不需要 Firebase Console。", "success");
            updatePushDebug();
        })
        .catch(function(error) {
            setPushStatus(getErrorMessage(error), "error");
            updatePushDebug();
        });
}

function showPushMessage(title, body, source) {
    var box = document.getElementById("pushMessageBox");
    var content = document.getElementById("pushMessageContent");

    if (!box || !content) {
        return;
    }

    content.innerHTML =
        "<strong>" + escapeHtml(title || "Firebase 推播") + "</strong><br>" +
        escapeHtml(body || "你有一則新的推播通知。") + "<br>" +
        '<span class="notification-meta">來源：' + escapeHtml(source || "Firebase") + "，時間：" + new Date().toLocaleTimeString() + "</span>";
    box.style.display = "block";
}

function addPushMessageToNotificationLog(title, body, source) {
    if (typeof window.addExternalNotificationToLog === "function") {
        window.addExternalNotificationToLog(title, body, source);
    }
}

function escapeHtml(value) {
    return String(value)
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function handleServiceWorkerMessage(event) {
    var data = event.data || {};

    if (data.type !== "firebase-push-message") {
        return;
    }

    showPushMessage(data.title, data.body, "Firebase 背景推播");
    addPushMessageToNotificationLog(data.title, data.body, "Firebase 背景推播");
}

function getErrorMessage(error) {
    if (!error) {
        return "";
    }

    if (error.code && error.message) {
        return error.code + "：" + error.message;
    }

    return error.message || String(error);
}

function getSupportText(value) {
    return value ? "支援" : "不支援";
}

function updatePushDebug() {
    var el = document.getElementById("pushDebug");

    if (!el) {
        return;
    }

    el.innerHTML =
        "目前網址：" + window.location.href + "<br>" +
        "通知權限：" + (typeof Notification !== "undefined" ? Notification.permission : "不支援") + "<br>" +
        "Service Worker：" + getFirebaseServiceWorkerUrl() + "<br>" +
        "Token 來源：" + window.location.origin;
}

document.addEventListener("DOMContentLoaded", function() {
    initializeFirebaseMessaging();
    updatePushDebug();

    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.addEventListener("message", handleServiceWorkerMessage);
    }
});

window.enableFirebasePush = enableFirebasePush;
window.copyFirebaseToken = copyFirebaseToken;
window.sendLocalTestNotification = sendLocalTestNotification;
window.sendDirectNotification = sendDirectNotification;