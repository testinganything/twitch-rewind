(function () {
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
    } catch {
      console.warn(LOG_PREFIX, "failed to parse GQL response body", text);
      return new Response(text, {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
      });
    }

    if (globalThis.vodID && vodChanged) {
      console.log(LOG_PREFIX, "Found vodID", globalThis.vodID);
    }

    if (text.includes("hasActiveTurbo")) {
      console.log(LOG_PREFIX, "Found turbo gql response", parsed);
    }

    const body = JSON.stringify(parsed, (key, val) =>
      key === "hasActiveTurbo"
        ? true
        : key === "vodID"
          ? globalThis.vodID || ""
          : val,
    );

    const headers = new Headers(response.headers);
    headers.set("Content-Type", "application/json; charset=utf-8");

    console.log(LOG_PREFIX, "GQL response (modified)", parsed);

    return new Response(body, {
      status: response.status,
      statusText: response.statusText,
      headers,
    });
  };
})();
