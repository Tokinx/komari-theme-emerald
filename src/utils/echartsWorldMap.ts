import { registerMap } from 'echarts/core'
import { emojiToRegionMap } from '@/utils/regionHelper'

type WorldGeoJson = Exclude<
  Parameters<typeof registerMap>[1],
  string | { geoJSON: unknown } | { svg: unknown }
>

const WORLD_MAP_NAME = 'komari-world'
const WORLD_MAP_ASSET_URL = `${import.meta.env.BASE_URL}maps/world.json`
const WORLD_MAP_CACHE_KEY_PREFIX = 'komari-theme-emerald:world-map'
const WORLD_MAP_CACHE_KEY = `${WORLD_MAP_CACHE_KEY_PREFIX}` // :${__BUILD_GIT_HASH__}

const ECHARTS_WORLD_NAME_TO_CODE: Record<string, string> = {
  'aland': 'AX',
  'andorra': 'AD',
  'antigua and barb.': 'AG',
  'bosnia and herz.': 'BA',
  'br. indian ocean ter.': 'IO',
  'cayman is.': 'KY',
  'central african rep.': 'CF',
  'congo': 'CG',
  'czech rep.': 'CZ',
  'côte d\'ivoire': 'CI',
  'dem. rep. congo': 'CD',
  'dem. rep. korea': 'KP',
  'dominican rep.': 'DO',
  'eq. guinea': 'GQ',
  'faeroe is.': 'FO',
  'falkland is.': 'FK',
  'fr. polynesia': 'PF',
  'fr. s. antarctic lands': 'TF',
  'heard i. and mcdonald is.': 'HM',
  'lao pdr': 'LA',
  'macedonia': 'MK',
  'n. cyprus': 'CY',
  'n. mariana is.': 'MP',
  's. geo. and s. sandw. is.': 'GS',
  's. sudan': 'SS',
  'saint helena': 'SH',
  'saint lucia': 'LC',
  'solomon is.': 'SB',
  'st. pierre and miquelon': 'PM',
  'st. vin. and gren.': 'VC',
  'swaziland': 'SZ',
  'são tomé and principe': 'ST',
  'turks and caicos is.': 'TC',
  'u.s. virgin is.': 'VI',
  'w. sahara': 'EH',
}

let worldMapPromise: Promise<string> | null = null
let worldMapRegistered = false

function isValidWorldGeoJson(value: unknown): value is WorldGeoJson {
  return Boolean(
    value
    && typeof value === 'object'
    && 'type' in value
    && 'features' in value
    && (value as { type?: unknown }).type === 'FeatureCollection'
    && Array.isArray((value as { features?: unknown }).features),
  )
}

function pruneStaleWorldMapCache(): void {
  if (typeof window === 'undefined')
    return

  try {
    for (let index = window.localStorage.length - 1; index >= 0; index -= 1) {
      const key = window.localStorage.key(index)
      if (!key?.startsWith(WORLD_MAP_CACHE_KEY_PREFIX) || key === WORLD_MAP_CACHE_KEY)
        continue
      window.localStorage.removeItem(key)
    }
  }
  catch {
  }
}

function readCachedWorldGeoJson(): WorldGeoJson | null {
  if (typeof window === 'undefined')
    return null

  try {
    const raw = window.localStorage.getItem(WORLD_MAP_CACHE_KEY)
    if (!raw)
      return null

    const parsed = JSON.parse(raw) as { data?: unknown }
    if (!isValidWorldGeoJson(parsed.data)) {
      window.localStorage.removeItem(WORLD_MAP_CACHE_KEY)
      return null
    }

    return parsed.data
  }
  catch {
    return null
  }
}

function writeCachedWorldGeoJson(worldGeoJson: WorldGeoJson): void {
  if (typeof window === 'undefined')
    return

  try {
    window.localStorage.setItem(
      WORLD_MAP_CACHE_KEY,
      JSON.stringify({
        buildHash: __BUILD_GIT_HASH__,
        data: worldGeoJson,
      }),
    )
    pruneStaleWorldMapCache()
  }
  catch {
  }
}

function normalizeCountryName(name: string): string {
  return name.trim().toLowerCase()
}

function createAliasToCodeMap(): Map<string, string> {
  const aliasToCodeMap = new Map<string, string>()
  for (const info of Object.values(emojiToRegionMap)) {
    for (const alias of [info.code, info.en, info.zh, ...info.aliases]) {
      const key = normalizeCountryName(alias)
      if (!key || aliasToCodeMap.has(key))
        continue
      aliasToCodeMap.set(key, info.code)
    }
  }
  return aliasToCodeMap
}

const aliasToCodeMap = createAliasToCodeMap()

function resolveCountryCode(name: string): string | null {
  const key = normalizeCountryName(name)
  if (!key)
    return null
  return ECHARTS_WORLD_NAME_TO_CODE[key] ?? aliasToCodeMap.get(key) ?? null
}

function normalizeWorldGeoJson(worldGeoJson: WorldGeoJson): WorldGeoJson {
  for (const feature of worldGeoJson.features) {
    const name = typeof feature.properties?.name === 'string' ? feature.properties.name : ''
    const code = resolveCountryCode(name)
    if (!code)
      continue

    feature.properties.name = code
  }

  return worldGeoJson
}

async function loadWorldGeoJson(): Promise<WorldGeoJson> {
  const cachedWorldGeoJson = readCachedWorldGeoJson()
  if (cachedWorldGeoJson)
    return cachedWorldGeoJson

  const response = await fetch(WORLD_MAP_ASSET_URL)
  if (!response.ok) {
    throw new Error(`Failed to load world map asset: ${response.status}`)
  }

  const worldGeoJson = normalizeWorldGeoJson(await response.json() as WorldGeoJson)
  writeCachedWorldGeoJson(worldGeoJson)
  return worldGeoJson
}

export async function ensureWorldMapRegistered(): Promise<string> {
  if (worldMapRegistered)
    return WORLD_MAP_NAME

  if (!worldMapPromise) {
    worldMapPromise = loadWorldGeoJson()
      .then((worldGeoJson) => {
        registerMap(WORLD_MAP_NAME, worldGeoJson)
        worldMapRegistered = true
        return WORLD_MAP_NAME
      })
      .catch((error) => {
        worldMapPromise = null
        throw error
      })
  }

  return worldMapPromise
}
