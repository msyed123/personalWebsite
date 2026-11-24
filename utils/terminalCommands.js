const commands = {
  cd: { synopsis: 'cd [DIRECTORY]', summary: 'Change directory.', detail: 'Use cd, cd ~, cd /, cd home, or cd .. to return home. Use cd . to stay in the current directory. Run ls for the available directories.' },
  pwd: { synopsis: 'pwd', summary: 'Print the current directory.' },
  ls: { synopsis: 'ls [-a] [-l]', summary: 'List virtual website directories.',
    options: '    -a, --all   Include . and ..\n    -l          Use long format. Combine flags as -la or -al.' },
  whoami: { synopsis: 'whoami', summary: 'Print the current virtual terminal user.' },
  echo: { synopsis: 'echo [--] [TEXT]', summary: 'Print the supplied text.', detail: 'Prints text literally without shell expansion. Use -- before text that starts with a hyphen.' },
  clear: { synopsis: 'clear', summary: 'Clear terminal output and close any open card or map.' },
  date: { synopsis: 'date', summary: 'Print the current local date and time.' },
  nowplaying: {
    synopsis: 'nowplaying [--connect]\n    spotify [--connect]',
    summary: 'Show the current or last played Spotify track.',
    detail: 'spotify is an alias for nowplaying.',
    options: '    --connect    Open the site-owner Spotify sign-in page.'
  },
  chmod: { synopsis: 'chmod', summary: 'Toggle the website’s light and dark themes.', detail: 'This site-specific shortcut does not change file permissions.' },
  weather: { synopsis: 'weather [LOCATION]', summary: 'Open the weather map.', detail: 'Locations may contain spaces. The default is Seattle.' },
  traffic: { synopsis: 'traffic [LOCATION]', summary: 'Open the traffic map.', detail: 'Locations may contain spaces. The default is Seattle.' },
  snake: { synopsis: 'snake', summary: 'Play Snake on desktop.' },
  tetris: { synopsis: 'tetris', summary: 'Play Tetris on desktop.' },
  help: { synopsis: 'help [COMMAND]', summary: 'List commands, or show the manual for one command.' },
  man: { synopsis: 'man COMMAND', summary: 'Show the manual for a command.' }
}

const canonicalName = name => name === 'spotify' ? 'nowplaying' : name
const option = token => token?.replace(/^[—–]/, '--')
const isHelp = token => /^(?:-h|--help)$/.test(option(token) || '')
const known = name => Object.hasOwn(commands, name)

export function terminalManual(name) {
  const command = canonicalName(name)
  if (!known(command)) return 'No manual entry for ' + name
  const { synopsis, summary, detail, options } = commands[command]
  const names = command === 'nowplaying' ? 'nowplaying, spotify' : command
  return 'NAME\n    ' + names + ' - ' + summary +
    '\nSYNOPSIS\n    ' + synopsis +
    '\nDESCRIPTION\n    ' + (detail || summary) +
    '\nOPTIONS\n    -h, --help  Show this manual.' + (options ? '\n' + options : '')
}

export function terminalHelp() {
  return 'Available commands:\n' + Object.entries(commands).map(([name, info]) => {
    const label = name === 'nowplaying' ? 'nowplaying, spotify' : name
    return '  ' + label + '  ' + info.summary
  }).join('\n') + '\n\nUse man COMMAND or COMMAND --help for usage.'
}

export function parseTerminalCommand(input) {
  const [rawName, ...rawArgs] = input.trim().split(/\s+/)
  const name = rawName.toLowerCase()
  const args = rawArgs.map(arg => arg.toLowerCase())
  const command = canonicalName(name)
  const output = text => ({ action: 'output', text })
  if (!known(command)) return output('-bash: ' + name + ': command not found')

  if (args.length === 1 && isHelp(args[0])) return output(terminalManual(name))

  const usage = () => output(name + ': invalid arguments\nUsage: ' +
    commands[command].synopsis.split('\n')[name === 'spotify' ? 1 : 0].trim() +
    '\nTry ' + name + ' --help.')
  if (command === 'help' || command === 'man') {
    if (args.length === 1 && !option(args[0]).startsWith('-')) return output(terminalManual(args[0]))
    if (command === 'help' && !args.length) return output(terminalHelp())
    return usage()
  }
  if (command === 'ls') {
    let all = false
    let long = false
    for (const arg of args.map(option)) {
      if (arg === '--all') all = true
      else if (/^-[al]+$/.test(arg)) {
        all ||= arg.includes('a')
        long ||= arg.includes('l')
      } else return usage()
    }
    return { action: 'execute', command, all, long }
  }
  if (command === 'echo') {
    const text = input.trim().slice(rawName.length).trimStart()
    if (args[0] === '--') return { action: 'execute', command, argument: text.slice(2).trimStart() }
    if (option(args[0])?.startsWith('-')) return usage()
    return { action: 'execute', command, argument: text }
  }
  if (command === 'weather' || command === 'traffic') {
    if (args.some(arg => option(arg).startsWith('-'))) return usage()
    return { action: 'execute', command, argument: args.join(' ') || 'Seattle' }
  }
  if (command === 'cd') {
    if (args.length > 1 || option(args[0])?.startsWith('-')) return usage()
    return { action: 'execute', command, argument: args[0] || 'home' }
  }
  if (command === 'nowplaying' && args.length === 1 &&
      ['--connect', 'connect'].includes(option(args[0]))) {
    return { action: 'connect' }
  }
  if (args.length) return usage()
  return { action: 'execute', command }
}

export function formatTerminalDirectory(entries, { all, long } = {}) {
  const names = all ? ['.', '..', ...entries] : entries
  if (!long) return names.join('  ')
  return 'total ' + names.length + '\n' +
    names.map(name => 'drwxr-xr-x  2 user  staff   64B  ' + name).join('\n')
}
