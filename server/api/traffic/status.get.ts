// The client only sees capabilities, not credentials or provider-specific URLs.
export default defineEventHandler((event) => {
  const config = useRuntimeConfig(event)
  return {
    roads: Boolean(config.tomtomTrafficKey),
    stations: Boolean(config.wsdotAccessCode),
    refreshSeconds: 180
  }
})
