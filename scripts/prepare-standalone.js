const fs = require('fs')
const path = require('path')

const root = path.join(__dirname, '..')
const standalone = path.join(root, '.next', 'standalone')

function copyIfExists(source, target) {
  if (!fs.existsSync(source)) return
  fs.rmSync(target, { recursive: true, force: true })
  fs.cpSync(source, target, { recursive: true })
}

copyIfExists(path.join(root, 'public'), path.join(standalone, 'public'))
copyIfExists(path.join(root, '.next', 'static'), path.join(standalone, '.next', 'static'))
