import type { AppConfig } from '../../shared/types'

/** useConfigForm.updateField 的类型，供各设置区块复用 */
export type UpdateField = <K extends keyof AppConfig>(key: K, value: AppConfig[K]) => void
