const TOKEN_KEY = "campuspulse_access_token";

export const tokenStorage = {
  getToken(): string | null {
    return window.sessionStorage.getItem(TOKEN_KEY);
  },
  setToken(token: string): void {
    window.sessionStorage.setItem(TOKEN_KEY, token);
  },
  clearToken(): void {
    window.sessionStorage.removeItem(TOKEN_KEY);
  },
};
