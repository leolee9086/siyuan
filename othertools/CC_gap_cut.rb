require 'sketchup.rb'
require 'extensions.rb'

module CCModule

module GapCut

  VERSION = "0.0.1"
  PLUGIN_NAME = "开缝切割".freeze
  PLUGIN = self

  ext = SketchupExtension.new(PLUGIN_NAME, (File.join(File.dirname(__FILE__),"CC_gap_cut", "gap_cut")))
  ext.description = ("Use a three-point infinite plane to create configurable gap cuts on selected groups/components, with optional retained core material and capped cut faces.")
  ext.version = VERSION
  ext.creator = "leolee9086,zhi"
  ext.copyright = "2026,leolee. All rights reserved."
  Sketchup.register_extension ext, true
end

end
