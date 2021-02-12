// ==UserScript==
// @name         Torn Stock Monitor
// @namespace    https://github.com/torn-tools/stock-monitor
// @version      1.0.1
// @description  Monitor for available shares on stock exchange page
// @author       josephting [2272298]
// @include      https://www.torn.com/stockexchange.php*
// @grant        GM_notification
// @updateURL    https://github.com/josephting/torn-tools/raw/master/stock-monitor/stock-monitor.user.js
// ==/UserScript==

(function() {
    'use strict';

    const monitoredStock = ['FHG'];

    const observer = new MutationObserver(function() {
        monitoredStock.forEach(stock => {
            if (document.querySelector(`#info-stock-${stock.toLowerCase()}`)) {
                var availableShares = document.querySelector(`#info-stock-${stock.toLowerCase()} ul li:last-child`).innerText.replace(/[\r\n]+/g, '').match(/shares for sale:([\d,]+)/i)[1];
                if (availableShares != '0') {
                    GM_notification(`${stock} has ${availableShares} available shares`);
                    observer.disconnect();
                    clearInterval(stockOpener);
                    document.querySelector('title').innerText = '(!) ' + document.querySelector('title').innerText;
                }
            }
        });
    });
    observer.observe(document, { childList: true, subtree: true });

    let i = 0;
    const stockOpener = setInterval(() => {
        if (i === monitoredStock.length) {
            document.location.reload();
        }
        document.querySelector(`li[data-stock=${monitoredStock[i].toLowerCase()}] div`).click();
        i++;
    }, 5000);
})();
