import { defaultNewsTopic, isNewsTopic, newsTopics } from './newsTopics.js'

const commands = {
  cd: { synopsis: 'cd [DIRECTORY]', summary: 'Change directory.', detail: 'Use cd, cd ~, cd /, cd home, or cd .. to return home. Use cd . to stay in the current directory. Run ls for the available directories.' },
  pwd: { synopsis: 'pwd', summary: 'Print the current directory.' },
  ls: { synopsis: 'ls [-a] [-l]', summary: 'List virtual website directories.',
    options: '    -a, --all   Include . and ..\n    -l          Use long format. Combine flags as -la or -al.' },
  whoami: { synopsis: 'whoami', summary: 'Print the current virtual terminal user.' },
  cat: { synopsis: 'cat FILE', summary: 'Read a public virtual file.', detail: 'Use ls to see the available files. Only virtual files are readable.' },
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
  news: {
    synopsis: 'news [--topic TOPIC | --topics]',
    summary: 'Read the latest headlines and topic feeds.',
    options: '    --topic TOPIC  Open a specific feed.\n    --topics       List available feeds.'
  },
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
  if (command === 'cat') {
    if (args.length !== 1 || option(args[0]).startsWith('-')) return usage()
    return { action: 'execute', command, argument: args[0] }
  }
  if (command === 'weather' || command === 'traffic') {
    if (args.some(arg => option(arg).startsWith('-'))) return usage()
    return { action: 'execute', command, argument: args.join(' ') || 'Seattle' }
  }
  if (command === 'news') {
    const topics = newsTopics.map(({ id }) => id).join(', ')
    if (!args.length) return { action: 'execute', command, argument: defaultNewsTopic }
    if (args.length === 1 && option(args[0]) === '--topics') return output('News topics: ' + topics)
    if (args.length === 2 && option(args[0]) === '--topic') {
      if (isNewsTopic(args[1])) return { action: 'execute', command, argument: args[1] }
      return output('news: unknown topic. Available topics: ' + topics)
    }
    return usage()
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

const publicFiles = {
  README: () => 'Welcome to Mamoon’s website terminal.\n\nUse help to see commands, ls to explore the site, and cd to visit a page.\n' +
    'Tab completes known commands and paths. Use ↑ and ↓ to recall recent commands.\nNo real files or shell commands are available.',
  'commands.txt': terminalHelp
}

export const virtualTerminalFiles = Object.keys(publicFiles)

export function readVirtualTerminalFile(path) {
  // Recognize only exact public names and one optional virtual root prefix.
  // Do not normalize traversal, consult the filesystem, or make requests.
  const normalized = path.replace(/^(?:~?\/|\.\/)/, '').toLowerCase()
  const file = virtualTerminalFiles.find(name => name.toLowerCase() === normalized)
  return file ? publicFiles[file]() : null
}

export function formatTerminalDirectory(entries, { all, long } = {}, files = []) {
  const dirs = all ? ['.', '..', ...entries] : entries
  if (!long) return [...dirs, ...files].join('  ')
  return 'total ' + (dirs.length + files.length) + '\n' +
    [...dirs.map(name => 'drwxr-xr-x  2 user  staff   64B  ' + name),
      ...files.map(name => '-r--r--r--  1 user  staff         ' + name)].join('\n')
}

export function completeTerminalInput(input, directories = []) {
  const match = /^(.*?)([^\s]*)$/.exec(input)
  if (!match) return null
  const [, head, word] = match
  if (!word) return null
  const names = [...Object.keys(commands), 'spotify']
  const prefix = head.trim().toLowerCase()
  const command = canonicalName(prefix)
  let candidates
  if (!prefix) candidates = names
  else if (command === 'cd' && !word.startsWith('-')) {
    const start = word.startsWith('/') ? '/' : ''
    candidates = [...directories, 'draft', '~', '.', '..'].map(dir => start + dir)
  } else if (command === 'cat' && !word.startsWith('-')) {
    const start = /^(?:~?\/|\.\/)/.exec(word)?.[0] || ''
    candidates = virtualTerminalFiles.map(file => start + file)
  } else if (command === 'man' || command === 'help') {
    candidates = [...names, '--help']
  } else if (/^news\s+(?:--|[—–])topic$/.test(prefix)) {
    candidates = newsTopics.map(({ id }) => id)
  } else if (known(command)) {
    candidates = ['--help']
    if (command === 'nowplaying') candidates.push('--connect')
    if (command === 'news') candidates.push('--topic', '--topics')
    if (command === 'ls') candidates.push('--all', '-a', '-l', '-al', '-la')
  } else return null

  const lower = option(word).toLowerCase()
  const matching = candidates.filter(candidate => candidate.toLowerCase().startsWith(lower))
  if (matching.length === 1) return head + matching[0] + ' '
  if (!matching.length) return null
  const shared = matching.reduce((a, b) => {
    let i = 0
    while (i < a.length && i < b.length && a[i].toLowerCase() === b[i].toLowerCase()) i++
    return a.slice(0, i)
  })
  return shared.length > lower.length ? head + shared : null
}

export function createTerminalHistory(limit = 50) {
  const entries = []
  let index = 0
  let draft = ''
  const resetCursor = () => { index = entries.length; draft = '' }
  return {
    remember(line) {
      if (entries.at(-1) !== line) {
        entries.push(line)
        if (entries.length > limit) entries.shift()
      }
      resetCursor()
    },
    resetCursor,
    recall(direction, current) {
      if (!entries.length || (direction === 1 && index === entries.length)) return null
      if (index === entries.length) draft = current
      index = Math.min(entries.length, Math.max(0, index + direction))
      return index === entries.length ? draft : entries[index]
    }
  }
}
