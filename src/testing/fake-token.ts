// JWT factice : le front ne lit que le payload (exp)
export function fakeToken(expiresInSeconds = 3600) {
    const exp = Math.floor(Date.now() / 1000) + expiresInSeconds;
    const payload = btoa(JSON.stringify({ id: 1, role: "admin", exp }));
    return `header.${payload}.signature`;
}
