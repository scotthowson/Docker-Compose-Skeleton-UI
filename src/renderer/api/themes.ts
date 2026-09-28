// =============================================================================
// Theme API — the six calls behind Settings → Appearance → Themes.
// A 404 from any of them means the server has no theme endpoints yet (API
// before 3.10): the caller keeps working with the built-in themes.
// =============================================================================

import { apiClient, ApiError } from './client'
import type { Theme, ThemeListResponse, ThemeSaveResponse, ThemeActiveResponse } from '../../shared/themes'
import { themeToJson } from '../../shared/themes'

/** GET /themes — the stored themes (without their css) and the one everyone follows; any signed-in user may read */
export function fetchThemes(): Promise<ThemeListResponse> {
  return apiClient.get<ThemeListResponse>('/themes')
}

/** GET /themes/{name} — one stored theme, the whole document */
export function fetchTheme(name: string): Promise<Theme> {
  return apiClient.get<Theme>(`/themes/${encodeURIComponent(name)}`)
}

/** POST /themes — store a theme (create or replace one of the same name); admin */
export function saveTheme(theme: Theme): Promise<ThemeSaveResponse> {
  return apiClient.post<ThemeSaveResponse>('/themes', JSON.parse(themeToJson(theme)))
}

/** DELETE /themes/{name}; admin. Dashboards following it go back to the default look. */
export function deleteTheme(name: string): Promise<{ success: boolean }> {
  return apiClient.delete<{ success: boolean }>(`/themes/${encodeURIComponent(name)}`)
}

/** POST /themes/import — the server fetches an https JSON document (≤ 256 KB) and stores it; 409 when the name is taken and replace is not set; admin */
export function importTheme(url: string, replace = false): Promise<ThemeSaveResponse> {
  return apiClient.post<ThemeSaveResponse>('/themes/import', replace ? { url, replace: true } : { url }, 45000)
}

/** PUT /themes/active — the theme every dashboard follows ("" = the default look); it must be stored first (404 otherwise); admin */
export function setActiveTheme(name: string): Promise<ThemeActiveResponse> {
  return apiClient.put<ThemeActiveResponse>('/themes/active', { name })
}

/** true when the error says the server has no theme endpoints */
export function isThemeApiMissing(err: unknown): boolean {
  return err instanceof ApiError && err.status === 404
}
