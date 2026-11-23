require "json"

root = File.expand_path("..", __dir__)
files = Dir.glob(File.join(root, "presets", "*.json")).sort_by { |path| File.basename(path).unicode_normalize(:nfc) }
abort "No se encontraron archivos JSON en presets/." if files.empty?

presets = files.map do |path|
  { name: File.basename(path, ".json").unicode_normalize(:nfc), data: JSON.parse(File.read(path, encoding: "UTF-8")) }
end
abort "Hay nombres de escenarios duplicados." unless presets.map { |preset| preset[:name] }.uniq.size == presets.size

output = "const PRESETS = #{JSON.generate(presets)};\n"
destination = File.join(root, "assets", "presets.js")
if ARGV == ["--check"]
  abort "assets/presets.js no coincide con los archivos JSON; ejecuta ruby scripts/build-presets.rb." unless
    File.exist?(destination) && File.read(destination, encoding: "UTF-8") == output
  puts "Escenarios actualizados."
elsif ARGV.empty?
  File.write(destination, output)
  puts "Generados #{presets.size} escenarios en assets/presets.js."
else
  abort "Uso: ruby scripts/build-presets.rb [--check]"
end
