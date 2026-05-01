// ==UserScript==
// @name         Twitch Rewind - uBlock Origin
// @namespace    https://github.com/YOUR_GITHUB_USERNAME/twitch-rewind
// @version      1.0.1
// @description  Enable rewind/seek bar on Twitch live streams
// @match        https://www.twitch.tv/*
// @match        https://twitch.tv/*
// @grant        none
// @run-at       document-start
// ==/UserScript==

(function () {
    'use strict';

    const LOG_PREFIX = "[Twitch Rewind]";

    const origFetch = window.fetch.bind(window);

    function requestUrl(input) {
        if (typeof input === "string") return input;
        if (input instanceof Request) return input.url;
        return String(input);
    }

    function isGqlRequest(input) {
        try {
            const href = requestUrl(input);
            const u = new URL(href, location.href);
            return u.pathname.includes("/gql");
        } catch {
            return false;
        }
    }

    window.fetch = async function (...args) {
        const response = await origFetch(...args);

        if (!isGqlRequest(args[0])) return response;

        const text = await response.text();
        let vodChanged = false;
        let parsed;

        try {
            parsed = JSON.parse(text, (_, val) => {
                if (val?.__typename === "VideoConnection") {
                    vodChanged = globalThis.vodID !== val?.edges?.[0]?.node?.id;
                    globalThis.vodID = val?.edges?.[0]?.node?.id;
                }
                return val;
            });
        } catch (e) {
            console.warn(LOG_PREFIX, "Failed to parse GQL response", e);
            return new Response(text, { 
                status: response.status, 
                statusText: response.statusText, 
                headers: response.headers 
            });
        }

        if (globalThis.vodID && vodChanged) {
            console.log(LOG_PREFIX, "New VOD detected:", globalThis.vodID);
        }

        // Modify the response
        const body = JSON.stringify(parsed, (key, val) => {
            if (key === "hasActiveTurbo") return true;
            if (key === "vodID") return globalThis.vodID || "";
            return val;
        });

        const headers = new Headers(response.headers);
        headers.set("Content-Type", "application/json; charset=utf-8");

        return new Response(body, {
            status: response.status,
            statusText: response.statusText,
            headers
        });
    };

    console.log(LOG_PREFIX, "Successfully loaded");
})();
