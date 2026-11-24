import { test } from 'node:test'
import assert from 'node:assert/strict'
import { completeTerminalInput, createTerminalHistory, formatTerminalDirectory, parseTerminalCommand,
  readVirtualTerminalFile, terminalManual, virtualTerminalFiles } from '../utils/terminalCommands.js'

test('spotify and nowplaying are the same playback command', () => {
  const playback = { action: 'execute', command: 'nowplaying' }
  assert.deepEqual(parseTerminalCommand('nowplaying'), playback)
  assert.deepEqual(parseTerminalCommand('SPOTIFY'), playback)
})

test('both names route the same documented connection flag without opening it for help', () => {
  for (const name of ['spotify', 'nowplaying']) {
    for (const flag of ['--connect', '—connect', '–connect', 'connect']) {
      assert.deepEqual(parseTerminalCommand(name + ' ' + flag), { action: 'connect' })
    }
    assert.match(parseTerminalCommand(name + ' —help').text, /OPTIONS\n.*--help[\s\S]+--connect/)
    assert.match(parseTerminalCommand(name + ' --connect trailing').text, /invalid arguments/)
  }
})

test('help and man agree with command flags and reject unknown manuals', () => {
  for (const name of ['pwd', 'ls', 'cd', 'weather', 'traffic', 'chmod', 'clear', 'date', 'whoami', 'echo', 'snake', 'tetris', 'help', 'man', 'spotify']) {
    assert.deepEqual(parseTerminalCommand('man ' + name), parseTerminalCommand('help ' + name))
    assert.equal(parseTerminalCommand(name + ' -h').text, terminalManual(name))
    assert.equal(parseTerminalCommand(name + ' --help').text, terminalManual(name))
  }
  assert.match(parseTerminalCommand('help').text, /Available commands[\s\S]+nowplaying, spotify/)
  assert.equal(parseTerminalCommand('man constructor').text, 'No manual entry for constructor')
})

test('ls lists only supplied virtual entries and optional dot markers', () => {
  const entries = ['/example', 'public']
  assert.equal(formatTerminalDirectory(entries, parseTerminalCommand('ls')), '/example  public')
  assert.equal(formatTerminalDirectory(entries, parseTerminalCommand('ls -a')), '.  ..  /example  public')
  assert.equal(formatTerminalDirectory(entries, parseTerminalCommand('ls --all')), '.  ..  /example  public')
  for (const flags of ['-la', '-al', '-a -l']) {
    const actual = formatTerminalDirectory(entries, parseTerminalCommand('ls ' + flags))
    assert.match(actual, /^total 4\n/)
    assert.deepEqual(actual.split('\n').slice(1).map(line => line.split('  ').at(-1)), ['.', '..', '/example', 'public'])
  }
  assert.match(parseTerminalCommand('ls -z').text, /Usage: ls/)
})

test('routes and multi-word map arguments still work, with errors for unsupported flags', () => {
  assert.equal(parseTerminalCommand('cd').argument, 'home')
  assert.equal(parseTerminalCommand('cd .').argument, '.')
  assert.equal(parseTerminalCommand('cd ~').argument, '~')
  assert.equal(parseTerminalCommand('cd /projects').argument, '/projects')
  assert.match(parseTerminalCommand('cd two arguments').text, /Usage: cd/)
  assert.deepEqual(parseTerminalCommand('weather New York'), { action: 'execute', command: 'weather', argument: 'new york' })
  assert.equal(parseTerminalCommand('traffic').argument, 'Seattle')
  assert.match(parseTerminalCommand('weather --unsupported').text, /Usage: weather/)
})

test('whoami is virtual and echo preserves case and literal text', () => {
  assert.deepEqual(parseTerminalCommand('whoami'), { action: 'execute', command: 'whoami' })
  assert.equal(parseTerminalCommand('echo Hello   Seattle $HOME').argument, 'Hello   Seattle $HOME')
  assert.equal(parseTerminalCommand('echo -- -not-an-option').argument, '-not-an-option')
  assert.match(parseTerminalCommand('echo -n text').text, /Usage: echo/)
})

test('completion handles commands, flags and allowlisted paths without eating Tab on no match', () => {
  assert.equal(completeTerminalInput('spot'), 'spotify ')
  assert.equal(completeTerminalInput('nowplaying —con'), 'nowplaying --connect ')
  assert.equal(completeTerminalInput('cd /pro', ['projects', 'about']), 'cd /projects ')
  assert.equal(completeTerminalInput('cat ~/re'), 'cat ~/README ')
  assert.equal(completeTerminalInput('man now'), 'man nowplaying ')
  for (const current of ['spotify ', 'c', 'cd /private', 'cat ../../re', 'echo arbitrary words']) {
    assert.equal(completeTerminalInput(current), null, current)
  }
})

test('history is bounded, deduplicates and restores the unsent command', () => {
  const history = createTerminalHistory(2)
  assert.equal(history.recall(-1, ''), null)
  history.remember('ls')
  history.remember('whoami')
  history.remember('whoami')
  history.remember('pwd')
  assert.equal(history.recall(-1, 'unsent draft'), 'pwd')
  assert.equal(history.recall(-1, 'pwd'), 'whoami')
  assert.equal(history.recall(-1, 'whoami'), 'whoami')
  assert.equal(history.recall(1, 'whoami'), 'pwd')
  assert.equal(history.recall(1, 'pwd'), 'unsent draft')
  assert.equal(history.recall(1, 'unsent draft'), null)
  assert.equal(createTerminalHistory().recall(-1, ''), null)
})

test('cat reads only deliberate public virtual files and ls identifies them as files', () => {
  assert.match(readVirtualTerminalFile('/README'), /Welcome/)
  assert.match(readVirtualTerminalFile('~/commands.txt'), /Available commands/)
  assert.equal(readVirtualTerminalFile('../README'), null)
  assert.equal(readVirtualTerminalFile('/etc/passwd'), null)
  assert.equal(readVirtualTerminalFile('/.env'), null)
  assert.match(parseTerminalCommand('cat').text, /Usage: cat FILE/)
  assert.match(parseTerminalCommand('cat -n README').text, /Usage: cat FILE/)
  assert.deepEqual(parseTerminalCommand('cat README'), { action:'execute', command:'cat', argument:'readme' })
  assert.match(formatTerminalDirectory(['about'], { long:true }, virtualTerminalFiles), /-r--r--r--.*README/)
})
