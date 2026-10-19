// One place for all backend calls, so components stay simple.
async function request(url, options) {
    let res;
    try {
        res = await fetch(url, options);
    } catch {
        throw new Error("Can't reach the server. Is the backend running?");
    }

    if (!res.ok) {
        let message = "Something went wrong.";
        try {
            const body = await res.json();
            if (typeof body.detail === "string") message = body.detail;
            // FastAPI validation errors arrive as a list of {msg, loc, ...}
            else if (Array.isArray(body.detail)) message = body.detail.map((d) => d.msg).join("; ");
        } catch {
            /* response had no JSON body */
        }
        throw new Error(message);
    }
    return res.json();
}

export function uploadCsv(file) {
    const form = new FormData();
    form.append("file", file);
    // Don't set Content-Type yourself: the browser adds it, including
    // the multipart "boundary" that the server needs to split the file out.
    return request("/api/upload", { method: "POST", body: form });
}

export const getSamples = () => request("/api/samples");

export const loadSample = (id) => request(`/api/samples/${id}`, { method: "POST" });
export const getProfile = (id) => request(`/api/datasets/${id}/profile`);

export const preprocess = (id, config) =>
    request(`/api/datasets/${id}/preprocess`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(config),
    });