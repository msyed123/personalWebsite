export default defineEventHandler((event) => ({
  enabled: Boolean(useRuntimeConfig(event).tomtomTrafficKey)
}))
