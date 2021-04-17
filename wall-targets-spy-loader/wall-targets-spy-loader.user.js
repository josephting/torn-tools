// ==UserScript==
// @name         Wall Targets Spy Loader
// @namespace    https://github.com/josephting/torn-tools/tree/master/wall-targets-spy-loader
// @version      0.9.1
// @updateURL    https://github.com/josephting/torn-tools/raw/master/wall-targets-spy-loaders/wall-targets-spy-loader.user.js
// @downloadURL  https://github.com/josephting/torn-tools/raw/master/wall-targets-spy-loaders/wall-targets-spy-loader.user.js
// @supportURL   https://github.com/josephting/torn-tools/issues/new
// @description  Load spy from Torn Stats for targets that's on the wall
// @author       josephting [2272298]
// @match        https://www.torn.com/factions.php?*
// @grant        GM_setValue
// @grant        GM_getValue
// @grant        GM_xmlhttpRequest
// @grant        GM_addStyle
// @connect      www.tornstats.com
// ==/UserScript==

const API_KEY = ''; // Torn API key - https://www.torn.com/preferences.php#tab=api
const spyCacheTTL = 86400000; // Refresh cached spy that was found every 24 hours
const noSpyRetry = 300000; // Retry "Spy not found." every 5 minutes (300000 milliseconds)
const tickRate = 1000; // TornStats API load throttling (once every second)

(function() {
    'use strict';

    const queue = [];

    const getUserIdFromNode = node => {
        if (!node || !node.querySelector('.member a.user.name')) return null;
        let m = node.querySelector('.member a.user.name').href.match(/=(\d+)/);
        if (m) {
            return m[1];
        }
        return null;
    };

    const getSpy = (uid, cb) => {
        let cache = GM_getValue('spys', {});
        if (uid in cache && new Date().getTime() - cache[uid].cacheTimestamp < spyCacheTTL) {
            if (cache[uid].spy.status || (!cache[uid].spy.status && new Date().getTime() - cache[uid].cacheTimestamp < noSpyRetry)) {
                if (queue.length > 0) tickerFn();
                return cb(cache[uid]);
            }
        }
        loadSpy(uid, spyData => cb(spyData));
    };

    const loadSpy = (uid, cb) => {
        GM_xmlhttpRequest({
            method: 'GET',
            url: `https://www.tornstats.com/api.php?key=${API_KEY}&action=spy&target=${uid}`,
            onload: function(response) {
                if (response.status >= 200 && response.status < 300) {
                    let spyData = JSON.parse(response.responseText);
                    let cache = GM_getValue('spys', {});
                    cache[uid] = {cacheTimestamp: new Date().getTime(), ...spyData};
                    GM_setValue('spys', cache);
                    cb(spyData);

                    let headers = getResponseHeaders(response);
                    let limit = parseInt(headers['x-rate-limit-limit-remaining'])
                    if (limit <= 0) {
                        clearInterval(ticker);
                        setTimeout(() => {
                            ticker = setInterval(tickerFn, tickRate);
                        }, 60000);
                    }
                } else {
                    cb(null);
                }
            }
        });
    };

    const getResponseHeaders = response => Object.fromEntries(response.responseHeaders.split("\r\n").slice(0, -1).map(v => v.split(': ')));

    const processNode = node => {
        let uid = getUserIdFromNode(node);
        if (!uid) return;
        if (node.querySelector('.wall-spy')) return;
        getSpy(uid, spyData => {
            if (!spyData) {
                queue.push(node);
                return;
            }
            let nodes = {
                root: getRootNode(uid, spyData),
                text: getTextNode(uid, spyData),
                desc: getDescNode(uid, spyData),
            };
            if (node.querySelector('a.user.name > span > img')) {
                nodes.root = node.querySelector('div.member.icons a.user.name');
                nodes.root.classList.add('wall-spy');
            } else {
                nodes.root.appendChild(nodes.text);
            }
            nodes.root.appendChild(nodes.desc);
            node.querySelector('div.member.icons').appendChild(nodes.root);
        });
    };

    const getRootNode = (uid, spyData) => {
        let node = document.createElement('a');
        node.href = `loader2.php?sid=getInAttack&user2ID=${uid}`;
        node.target = '_blank';
        node.classList.add('wall-spy');
        return node;
    };
    const getTextNode = (uid, spyData) => {
        let node = document.createElement('span');
        let deltaScore = spyData.spy.deltaTotal;
        node.innerText = spyData.spy.status ? deltaScore.toLocaleString() : '-';
        node.classList.add(deltaScore > 0 ? 'green' : 'red');
        return node;
    };
    const getDescNode = (uid, spyData) => {
        let node = document.createElement('span');
        if (spyData.spy.status) {
            node.innerText = `Total:${spyData.spy.total.toLocaleString()} Str:${spyData.spy.strength.toLocaleString()} Def:${spyData.spy.defense.toLocaleString()} Spd:${spyData.spy.speed.toLocaleString()} Dex:${spyData.spy.dexterity.toLocaleString()} `;
        } else {
            node.innerText = spyData.spy.message;
        }
        node.classList.add('details');
        return node;
    };

    const observer = new MutationObserver((mutations, observer) => {
        mutations.filter(v => v.target.classList.contains('members-list') && v.target.nodeName === 'UL' && v.addedNodes.length > 0 && v.addedNodes[0].nodeName === 'LI' && v.addedNodes[0].classList.contains('enemy')).forEach(mutation => {
            queue.push(mutation.addedNodes[0]);
        });
        mutations.filter(v => v.target.classList.contains('member') && v.target.classList.contains('icons') && v.target.classList.contains('left') && v.target.nodeName === 'DIV' && v.removedNodes.length >= 3 && v.addedNodes.length === 3).forEach(mutation => {
            queue.push(mutation.target.parentNode.parentNode);
        });
        mutations.filter(v => v.addedNodes.length > 0 && v.addedNodes[0].tagName === 'DIV' && v.addedNodes[0].classList.contains('faction-war')).forEach(mutation => {
            mutation.addedNodes[0].querySelectorAll('li.enemy').forEach(e => {
                queue.push(e);
            });
        });
    });

    const tickerFn = () => {
        let node = queue.shift();
        if (node) {
            processNode(node);
        }
    };

    let ticker

    if (API_KEY) {
        observer.observe(document.querySelector('#factions #react-root'), {attributes: false, childList: true, characterData: false, subtree:true});
        ticker = setInterval(tickerFn, tickRate);
    }

    GM_addStyle(`
    .wall-spy{float:right;margin-right:7px;text-decoration:none;position:relative;}
    .wall-spy .red{color:#FF7A4D;}
    .wall-spy .green{color:#85B200;}
    .wall-spy .details{color:#FFF;background:#000;display:inline-block;position:absolute;top:0;left:150%;opacity:0;transition:.3s;white-space:nowrap;border-radius:5px;padding:0 5px;}
    .wall-spy > span:hover + .details{opacity:1;left:calc(100% + 7px);}
    `);
})();
