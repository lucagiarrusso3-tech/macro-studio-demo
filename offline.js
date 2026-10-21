'use strict';
if ('serviceWorker' in navigator && window.isSecureContext) {
 navigator.serviceWorker.register('./sw.js', {updateViaCache:'none'}).catch(() => {});
}
