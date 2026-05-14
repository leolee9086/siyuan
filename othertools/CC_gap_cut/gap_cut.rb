# Three-point gap-cut tool for selected groups/components.
require 'sketchup.rb'

module CCModule::GapCut

  TOOL_NAME = '开缝切割'.freeze
  OPERATION_NAME = TOOL_NAME.freeze
  PREF_NAMESPACE = 'CCModule::GapCut'.freeze
  PREF_WIDTH = 'gap_width'.freeze
  PREF_BASELINE = 'baseline'.freeze
  BASELINE_LEFT = '左'.freeze
  BASELINE_CENTER = '中'.freeze
  BASELINE_RIGHT = '右'.freeze
  BASELINE_OPTIONS = [BASELINE_LEFT, BASELINE_CENTER, BASELINE_RIGHT].freeze
  DEFAULT_WIDTH = 10.mm
  EPSILON = 0.001.inch

  class GapCutTool

    def initialize
      @helper_group = nil
      @preserve_gap = false
      @drawn = false
      refresh_settings
      update_cursor
    end

    def activate
      @ip1 = Sketchup::InputPoint.new
      @ip2 = Sketchup::InputPoint.new
      @ip3 = Sketchup::InputPoint.new
      @ip = Sketchup::InputPoint.new
      reset(nil)
    end

    def deactivate(view)
      view.invalidate if @drawn
    end

    def onSetCursor
      UI.set_cursor(@cursor)
    end

    def enableVCB?
      true
    end

    def onMouseMove(_flags, x, y, view)
      reference = case @state
                  when 1
                    @ip1
                  when 2
                    @ip2
                  end

      if reference
        @ip.pick(view, x, y, reference)
      else
        @ip.pick(view, x, y)
      end

      view.tooltip = @ip.tooltip if @ip.valid?
      view.invalidate
    end

    def onLButtonDown(_flags, x, y, view)
      unless can_begin_cut?
        show_selection_error
        return
      end

      reference = case @state
                  when 1
                    @ip1
                  when 2
                    @ip2
                  end

      if reference
        @ip.pick(view, x, y, reference)
      else
        @ip.pick(view, x, y)
      end
      return unless @ip.valid?

      case @state
      when 0
        @ip1.copy!(@ip)
        @state = 1
      when 1
        if @ip1.position.distance(@ip.position) <= EPSILON
          UI.beep
          return
        end
        @ip2.copy!(@ip)
        @state = 2
      when 2
        plane = plane_from_points(@ip1.position, @ip2.position, @ip.position)
        unless plane
          UI.beep
          Sketchup.set_status_text('第三点不能与前两点共线。', SB_PROMPT)
          return
        end
        @ip3.copy!(@ip)
        perform_gap_cut
        reset(view)
      end

      update_status
      view.invalidate
    end

    def onCancel(_flag, view)
      reset(view)
    end

    def onUserText(text, view)
      width = CCModule::GapCut.parse_length(text)
      if width < 0
        UI.beep
        Sketchup.set_status_text('缝隙宽度不能为负数。', SB_PROMPT)
        return
      end

      save_settings(width, @baseline_mode)
      update_status
      view.invalidate if view
    rescue ArgumentError
      UI.beep
      Sketchup.set_status_text('无法识别该缝隙宽度。', SB_PROMPT)
    end

    def onKeyDown(key, repeat, _flags, view)
      return unless key == COPY_MODIFIER_KEY && repeat == 1

      @preserve_gap = true
      update_status
      view.invalidate if view
    end

    def onKeyUp(key, _repeat, _flags, view)
      return unless key == COPY_MODIFIER_KEY

      @preserve_gap = false
      update_status
      view.invalidate if view
    end

    def getExtents
      box = Sketchup.active_model.bounds
      [@ip1, @ip2, @ip3, @ip].each do |input_point|
        box.add(input_point.position) if input_point && input_point.valid?
      end
      box
    end

    def getMenu(menu, *_args)
      menu.add_item("基线位置: #{BASELINE_LEFT}#{current_marker(BASELINE_LEFT)}") {
        save_settings(@gap_width, BASELINE_LEFT)
      }
      menu.add_item("基线位置: #{BASELINE_CENTER}#{current_marker(BASELINE_CENTER)}") {
        save_settings(@gap_width, BASELINE_CENTER)
      }
      menu.add_item("基线位置: #{BASELINE_RIGHT}#{current_marker(BASELINE_RIGHT)}") {
        save_settings(@gap_width, BASELINE_RIGHT)
      }
      menu.add_separator
      menu.add_item('开缝切割设置...') {
        settings = CCModule::GapCut.configure_settings(gap_width: @gap_width, baseline: @baseline_mode)
        if settings
          refresh_settings(settings)
          update_status
        end
      }
    end

    def draw(view)
      draw_input_point(view, @ip1)
      draw_input_point(view, @ip2) if @state >= 1
      draw_input_point(view, @ip3) if @state >= 2
      draw_input_point(view, @ip)

      if @state == 1 && @ip1.valid? && @ip.valid?
        draw_line_halo(view, @ip1.position, @ip.position)
      elsif @state == 2 && @ip1.valid? && @ip2.valid? && @ip.valid?
        preview_plane_set(view)
      end

      @drawn = true
    end

    private

    def current_marker(mode)
      @baseline_mode == mode ? '  当前' : ''
    end

    def draw_input_point(view, input_point)
      return unless input_point && input_point.valid? && input_point.display?
      input_point.draw(view)
    end

    def axis_aligned_color(point_a, point_b)
      direction = point_b - point_a
      return nil if direction.length <= EPSILON
      direction.normalize
      return Sketchup::Color.new(255, 0, 0) if direction.parallel?(X_AXIS)
      return Sketchup::Color.new(0, 255, 0) if direction.parallel?(Y_AXIS)
      return Sketchup::Color.new(0, 0, 255) if direction.parallel?(Z_AXIS)
      nil
    end

    def draw_line_halo(view, point_a, point_b)
      axis_color = axis_aligned_color(point_a, point_b)
      line_color = axis_color || Sketchup::Color.new(255, 180, 80)
      draw_polyline(view, [point_a, point_b], line_color, 3)
    end

    def draw_cut_direction_arrow(view)
      return if @baseline_mode == BASELINE_CENTER
      return unless @ip1.valid? && @ip2.valid? && @ip.valid?

      plane = plane_from_points(@ip1.position, @ip2.position, @ip.position)
      return unless plane

      normal = plane_normal(plane)
      direction = @baseline_mode == BASELINE_LEFT ? normal : normal.reverse

      origin = @ip.position

      max_edge = [
        @ip1.position.distance(@ip2.position),
        @ip2.position.distance(@ip.position),
        @ip.position.distance(@ip1.position)
      ].max
      scale = [max_edge * 0.25, 50.mm].max
      tip = origin.offset(direction, scale)

      depth_bias = view.camera.direction.reverse
      bias_dist = [scale * 0.02, 2.mm].max

      origin_b = origin.offset(depth_bias, bias_dist)
      tip_b = tip.offset(depth_bias, bias_dist)

      arrow_color = Sketchup::Color.new(255, 80, 80)
      draw_polyline(view, [origin_b, tip_b], arrow_color, 3)

      _, yaxis = plane_axes(normal)
      head_size = scale * 0.35
      head_width = scale * 0.15
      head_base = tip.offset(direction.reverse, head_size)
      head_left = head_base.offset(yaxis, head_width)
      head_right = head_base.offset(yaxis.reverse, head_width)
      head_left_b = head_left.offset(depth_bias, bias_dist)
      head_right_b = head_right.offset(depth_bias, bias_dist)
      draw_polyline(view, [head_left_b, tip_b, head_right_b, tip_b], arrow_color, 2)
    end

    def draw_polyline(view, points, color, width = 2)
      return if points.length < 2
      view.line_width = width
      view.drawing_color = color
      view.draw(GL_LINE_STRIP, points)
    end

    def preview_plane_set(view)
      plane = plane_from_points(@ip1.position, @ip2.position, @ip.position)
      return unless plane

      center = preview_center_world(plane)
      size = preview_half_size_world
      left_offset, right_offset = baseline_offsets
      left_plane = offset_plane(plane, left_offset)
      right_plane = offset_plane(plane, right_offset)

      center_points = plane_frame_points(plane, project_point_to_plane(center, plane), size)
      left_points = plane_frame_points(left_plane, project_point_to_plane(center, left_plane), size)
      right_points = plane_frame_points(right_plane, project_point_to_plane(center, right_plane), size)

      draw_filled_plane(view, center_points, Sketchup::Color.new(255, 170, 70, 50))
      draw_plane_outline(view, center_points, Sketchup::Color.new(255, 170, 70), 2)
      draw_plane_outline(view, left_points, Sketchup::Color.new(90, 190, 255), 2)
      draw_plane_outline(view, right_points, Sketchup::Color.new(90, 190, 255), 2)
      draw_polyline(view, [@ip1.position, @ip2.position], Sketchup::Color.new(255, 220, 150), 1)
      draw_polyline(view, [@ip.position, @ip1.position], Sketchup::Color.new(255, 220, 150), 1)
      draw_line_halo(view, @ip2.position, @ip.position)
      draw_cut_direction_arrow(view)
    end

    def draw_filled_plane(view, points, color)
      view.drawing_color = color
      view.draw(GL_TRIANGLES, [points[0], points[1], points[2], points[0], points[2], points[3]])
    end

    def draw_plane_outline(view, points, color, width)
      loop = points + [points.first]
      draw_polyline(view, loop, color, width)
    end

    def preview_center_world(plane)
      box = selection_bounds_world
      if box && box.valid? && !box.empty?
        project_point_to_plane(box.center, plane)
      else
        centroid = Geom::Point3d.new(
          (@ip1.position.x + @ip2.position.x + @ip.position.x) / 3.0,
          (@ip1.position.y + @ip2.position.y + @ip.position.y) / 3.0,
          (@ip1.position.z + @ip2.position.z + @ip.position.z) / 3.0
        )
        project_point_to_plane(centroid, plane)
      end
    end

    def preview_half_size_world
      edges = []
      edges << @ip1.position.distance(@ip2.position) if @ip1.valid? && @ip2.valid?
      edges << @ip2.position.distance(@ip.position) if @ip2.valid? && @ip.valid?
      edges << @ip.position.distance(@ip1.position) if @ip.valid? && @ip1.valid?
      span = edges.max || 1.inch

      box = selection_bounds_world
      if box && box.valid? && !box.empty?
        span = [span, box.diagonal].max
      end

      [span * 0.75 + @gap_width, 20.mm].max
    end

    def selection_bounds_world
      targets = preview_targets
      return nil if targets.empty?

      box = Geom::BoundingBox.new
      targets.each do |target|
        add_bounds_to_box(box, target.bounds)
      end
      box
    end

    def add_bounds_to_box(box, bounds, transform = nil)
      corners = [
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.max.z)
      ]
      corners.each do |point|
        box.add(transform ? point.transform(transform) : point)
      end
    end

    def editable_targets
      explicit_selected_targets.reject(&:locked?)
    end

    def selected_loose_entities
      selection_entities.select { |entity|
        loose_geometry_entity?(entity)
      }
    end

    # 将明确选中的零散面/独立边视为一等切割目标，
    # 避免“只选了一部分零散几何”时悄悄退回到“切整个当前层”的分支。
    def selected_cut_entities
      editable_targets + selected_loose_entities
    end

    def preview_targets
      return selected_cut_entities unless selected_cut_entities.empty?
      return [] unless selection_entities.empty?

      context_cut_entities
    end

    def can_begin_cut?
      return true if selected_cut_entities.any?
      return false unless selection_entities.empty?

      context_cut_entities.any?
    end

    def selection_entities
      Sketchup.active_model.selection.to_a
    end

    def explicit_selected_targets
      selection_entities.select { |entity|
        entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
      }
    end

    def visible_unlocked_context_entities
      Sketchup.active_model.active_entities.to_a.select { |entity|
        next false unless entity.valid?
        next false if entity == @helper_group
        next false if entity.is_a?(Sketchup::SectionPlane)
        next false if entity.respond_to?(:locked?) && entity.locked?
        next false unless entity.visible?
        true
      }
    end

    # Reference:
    # The SketchUp Community "Group by Layer/Tag" plugin example groups loose
    # geometry as faces + free edges, instead of faces plus all of their border
    # edges again. We mirror that here to avoid duplicating face-bound edges in
    # the temporary cut container.
    def context_cut_entities
      entities = visible_unlocked_context_entities
      instances = entities.select { |entity|
        entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
      }
      faces = entities.grep(Sketchup::Face)
      free_edges = entities.grep(Sketchup::Edge).select { |edge| edge.faces.empty? }
      instances + faces + free_edges
    end

    def context_instance_targets
      context_cut_entities.select { |entity|
        entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
      }
    end

    def context_loose_entities
      context_cut_entities.select { |entity|
        loose_geometry_entity?(entity)
      }
    end

    def loose_intersect_targets
      visible_unlocked_context_entities.select { |entity|
        loose_geometry_entity?(entity)
      }
    end

    def loose_geometry_entity?(entity)
      return false unless entity&.valid?
      return false unless entity.visible?
      return false if entity.respond_to?(:locked?) && entity.locked?

      entity.is_a?(Sketchup::Face) ||
        (entity.is_a?(Sketchup::Edge) && entity.faces.empty?)
    end

    def show_selection_error
      if !explicit_selected_targets.empty? && editable_targets.empty? && selected_loose_entities.empty?
        UI.messagebox('当前选中的组/组件已锁定，请先解锁后再执行开缝切割。')
      elsif !selection_entities.empty? && selected_cut_entities.empty?
        UI.messagebox('当前选中的对象不支持开缝切割。请选择组/组件、零散面或独立边。')
      elsif context_cut_entities.empty?
        UI.messagebox('当前编辑层中没有可切割的对象。')
      else
        UI.messagebox('当前没有选中可切割对象。继续操作时，会提示你是否对当前层中的所有物体执行开缝切割。')
      end
    end

    def refresh_settings(settings = nil)
      settings ||= CCModule::GapCut.read_settings
      @gap_width = settings[:gap_width]
      @baseline_mode = settings[:baseline]
      update_cursor
    end

    def save_settings(width, baseline)
      refresh_settings(CCModule::GapCut.write_settings(width, baseline))
    end

    def update_cursor
      name = case @baseline_mode
             when BASELINE_LEFT then 'gap_cut_left'
             when BASELINE_RIGHT then 'gap_cut_right'
             else 'gap_cut'
             end
      @cursor = UI.create_cursor(File.join(File.dirname(__FILE__), 'images', "#{name}.png"), 1, 1)
    end

    def update_status
      prompt = case @state
               when 0
                 '选择第 1 个点定义切面'
               when 1
                 '选择第 2 个点定义切面'
               else
                 '选择第 3 个点定义切面'
               end

      gap_mode = @preserve_gap ? '保留中间料' : '删除中间料'
      prompt = "#{TOOL_NAME}: #{prompt}。当前宽度=#{CCModule::GapCut.format_length(@gap_width)}，基线=#{@baseline_mode}，#{gap_mode}，按住 Ctrl 可保留中间料，右键可调整基线。"
      Sketchup.set_status_text(prompt, SB_PROMPT)
      Sketchup.set_status_text('缝隙宽度', SB_VCB_LABEL)
      Sketchup.set_status_text(CCModule::GapCut.format_length(@gap_width), SB_VCB_VALUE)
    end

    def reset(view)
      @state = 0
      @ip1.clear if @ip1
      @ip2.clear if @ip2
      @ip3.clear if @ip3
      @ip.clear if @ip
      update_status

      if view
        view.tooltip = nil
        view.invalidate if @drawn
      end

      @drawn = false
    end

    def perform_gap_cut
      model = Sketchup.active_model
      explicit_targets = explicit_selected_targets
      selected_loose = selected_loose_entities
      targets = editable_targets.dup
      context_entities = nil
      cut_context_loose = false
      transient_context_targets = []

      # In an open edit context SketchUp exposes input points, bounds and instance
      # transformations in model space, so we keep the entire cut operation in
      # model coordinates instead of mixing in edit_transform.
      base_plane = plane_from_points(@ip1.position, @ip2.position, @ip3.position)
      return unless base_plane

      left_offset, right_offset = baseline_offsets
      left_plane = offset_plane(base_plane, left_offset)
      right_plane = offset_plane(base_plane, right_offset)

      context_mode = false

      if targets.empty? && selected_loose.empty?
        unless selection_entities.empty?
          show_selection_error
          return
        end

        unless context_cut_entities.any?
          show_selection_error
          return
        end

        result = UI.messagebox('当前没有选中对象，将对当前编辑层中的所有物体执行开缝切割，是否继续？', MB_YESNO)
        return unless result == IDYES

        context_mode = true
      end

      if context_mode
        context_entities = context_cut_entities
        targets = context_entities.select { |entity|
          entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
        }
        cut_context_loose = context_entities.any? { |entity|
          entity.is_a?(Sketchup::Face) || entity.is_a?(Sketchup::Edge)
        }

        raise '当前层中没有可用于整体切割的实体。' if targets.empty? && !cut_context_loose
      end

      bounds_sources = context_mode ? context_entities : (targets + selected_loose)
      bounds = selection_bounds_local(bounds_sources)

      model.start_operation(OPERATION_NAME, true)
      entities = model.active_entities

      if selected_loose.any?
        # 先把选中的零散几何包装成临时源对象，
        # 这样可以复用组/组件那条更稳定的切割流程，同时把切割范围严格限制在这批已选几何上。
        selection_source = build_transient_loose_source(entities, selected_loose, "#{TOOL_NAME}_Selection")
        if selection_source
          targets << selection_source
          transient_context_targets << selection_source
        end
      end

      if context_mode
        if cut_context_loose && top_level_context?
          # 顶层零散几何也走临时组这条路，
          # 因为在 SketchUp 2024 里，直接在模型根层切割/还原零散几何已经证明是不稳定的。
          context_source = build_transient_loose_source(entities, loose_intersect_targets, "#{TOOL_NAME}_Loose")
          if context_source
            context_source.name = "#{TOOL_NAME}_Loose"
            targets << context_source
            transient_context_targets << context_source
            cut_context_loose = false
          end
        end
      end

      new_selection = []
      transient_pieces = []
      skipped = context_mode ? 0 : (explicit_targets.length - editable_targets.length)

      cut_context_loose_geometry(entities, left_plane, right_plane, bounds) if cut_context_loose

      left_plane_group = nil
      right_plane_group = nil

      if targets.any?
        left_plane_group = create_plane_group(entities, left_plane, bounds)
        right_plane_group = create_plane_group(entities, right_plane, bounds)
      end

      targets.each do |target|
        next unless target.valid?
        explode_after_cut = transient_context_targets.include?(target)

        negative_piece = duplicate_instance(target)
        positive_piece = target
        middle_piece = @preserve_gap ? duplicate_instance(target) : nil

        trim_piece(negative_piece, left_plane, :negative, left_plane_group)
        trim_piece(positive_piece, right_plane, :positive, right_plane_group)
        trim_middle_piece(middle_piece, left_plane, right_plane, left_plane_group, right_plane_group) if middle_piece

        [negative_piece, middle_piece, positive_piece].each do |piece|
          next unless piece&.valid?
          if instance_empty?(piece)
            piece.erase!
          else
            if explode_after_cut
              transient_pieces << piece
            else
              new_selection << piece
            end
          end
        end
      end

      cleanup_entities([left_plane_group, right_plane_group])
      delete_helpers

      if transient_pieces.any?
        # 不在模型根层直接 explode，而是把结果重建回零散几何。
        # 这样既能保持最终结果仍是零散对象，也能避开 SketchUp 2024 的根层 explode 崩溃路径。
        new_selection.concat(rebuild_group_pieces_as_loose_geometry(transient_pieces))
      end

      new_selection = new_selection.flatten.select { |entity|
        entity.is_a?(Sketchup::Entity) && entity.valid?
      }
      model.selection.clear
      model.selection.add(new_selection) unless new_selection.empty?
      model.commit_operation

      if skipped > 0
        UI.messagebox("已跳过 #{skipped} 个锁定对象。")
      end
    rescue => error
      model.abort_operation if model
      delete_helpers
      UI.messagebox("开缝切割失败:\n#{error.message}")
    end

    def selection_bounds_local(targets)
      box = Geom::BoundingBox.new
      targets.each do |target|
        next unless target&.valid?
        add_bounds_to_box(box, target.bounds)
      end
      box
    end

    def cleanup_entities(entities)
      list = entities.compact.select { |entity| entity.valid? }
      return if list.empty?
      Sketchup.active_model.active_entities.erase_entities(list)
    end

    def top_level_context?
      Sketchup.active_model.active_path.nil?
    end

    def baseline_offsets
      case @baseline_mode
      when BASELINE_LEFT
        [0.0, @gap_width]
      when BASELINE_RIGHT
        [-@gap_width, 0.0]
      else
        [-@gap_width / 2.0, @gap_width / 2.0]
      end
    end

    def create_plane_group(entities, plane, bounds)
      group = entities.add_group
      center = bounds.valid? && !bounds.empty? ? bounds.center : ORIGIN
      half_size = [bounds.valid? && !bounds.empty? ? bounds.diagonal : 1.inch, @gap_width, 100.mm].max
      points = plane_frame_points(plane, project_point_to_plane(center, plane), half_size * 2.0)
      group.entities.add_face(points)
      group
    end

    def cut_context_loose_geometry(entities, left_plane, right_plane, bounds)
      # At model root, intersecting the whole active_entities collection is the
      # unstable part because it also includes non-face/edge entities such as
      # guides. Restrict the intersection to loose faces + free edges only and
      # write the new cut edges back into the current context.
      left_plane_group = create_plane_group(entities, left_plane, bounds)
      intersect_context_loose_entities(left_plane_group)
      cleanup_entities([left_plane_group])

      right_plane_group = create_plane_group(entities, right_plane, bounds)
      intersect_context_loose_entities(right_plane_group)
      cleanup_entities([right_plane_group])

      return if @preserve_gap

      transform = Geom::Transformation.new
      prune_raw_gap_geometry(entities, left_plane, right_plane)
      cap_cut_openings(entities, transform, left_plane)
      cap_cut_openings(entities, transform, right_plane)
    end

    def intersect_context_loose_entities(plane_group)
      loose_targets = loose_intersect_targets
      return if loose_targets.empty?

      plane_group.entities.intersect_with(
        false,
        plane_group.transformation,
        Sketchup.active_model.active_entities,
        Geom::Transformation.new,
        false,
        loose_targets
      )
    end

    def build_transient_loose_source(entities, loose_entities, name)
      snapshots = snapshot_loose_entities(loose_entities)
      return nil if snapshots.empty?

      removable_entities = removable_loose_entities(loose_entities)
      entities.erase_entities(removable_entities) unless removable_entities.empty?

      group = entities.add_group
      group.name = name
      build_loose_geometry_from_snapshots(group.entities, snapshots)
      group
    end

    def removable_loose_entities(loose_entities)
      faces = loose_entities.grep(Sketchup::Face).uniq.select(&:valid?)
      free_edges = loose_entities.grep(Sketchup::Edge).uniq.select(&:valid?)
      removable = faces.dup.concat(free_edges)

      # 删除选中面时，凡是只属于这些面的边也必须一并移走，
      # 否则原始零散边会残留在原位，与后面重建出来的切割结果重叠。
      exclusive_face_edges = faces.flat_map(&:edges).uniq.select { |edge|
        edge.valid? && (edge.faces - faces).empty?
      }
      removable.concat(exclusive_face_edges)
      removable.uniq
    end

    def snapshot_loose_entities(loose_entities)
      faces = loose_entities.grep(Sketchup::Face).uniq.filter_map { |face|
        snapshot_face_geometry(face, Geom::Transformation.new)
      }
      free_edges = loose_entities.grep(Sketchup::Edge).uniq.select { |edge|
        edge.faces.empty?
      }.filter_map { |edge|
        snapshot_edge_geometry(edge, Geom::Transformation.new)
      }

      return [] if faces.empty? && free_edges.empty?

      [{
        faces: faces,
        free_edges: free_edges
      }]
    end

    def rebuild_group_pieces_as_loose_geometry(pieces)
      snapshots = pieces.filter_map { |piece|
        snapshot_loose_geometry_piece(piece)
      }
      cleanup_entities(pieces)
      return [] if snapshots.empty?

      entities = Sketchup.active_model.active_entities
      build_loose_geometry_from_snapshots(entities, snapshots)
    end

    def build_loose_geometry_from_snapshots(entities, snapshots)
      created_entities = []
      face_records = []

      # 使用 EntitiesBuilder 直接重建最终的零散几何，
      # 避免再调用 Group#explode 走到那个不稳定的根层还原步骤。
      entities.build { |builder|
        snapshots.each do |snapshot|
          snapshot[:faces].each do |face_data|
            face = if face_data[:holes].empty?
                     builder.add_face(face_data[:outer])
                   else
                     builder.add_face(face_data[:outer], holes: face_data[:holes])
                   end
            next unless face

            apply_face_properties(face, face_data)
            face_records << [face, face_data]
            created_entities << face
          end

          snapshot[:free_edges].each do |edge_data|
            edge = builder.add_edge(edge_data[:start], edge_data[:end])
            next unless edge

            apply_edge_properties(edge, edge_data)
            created_entities << edge
          end
        end
      }

      face_records.each do |face, face_data|
        next unless face.valid?

        face.reverse! unless face.normal.samedirection?(face_data[:normal])
        apply_face_edge_properties(face, face_data[:edge_properties])
      end

      created_entities.uniq.select(&:valid?)
    end

    def snapshot_loose_geometry_piece(instance)
      return nil unless instance&.valid?

      entities = get_entities(instance)
      return nil unless entities

      transform = instance.transformation
      {
        faces: entities.grep(Sketchup::Face).filter_map { |face|
          snapshot_face_geometry(face, transform)
        },
        free_edges: entities.grep(Sketchup::Edge).select { |edge|
          edge.faces.empty?
        }.filter_map { |edge|
          snapshot_edge_geometry(edge, transform)
        }
      }
    end

    def snapshot_face_geometry(face, transform)
      outer = loop_points(face.outer_loop, transform)
      return nil if outer.length < 3

      {
        outer: outer,
        holes: face.loops.reject(&:outer?).map { |loop|
          loop_points(loop, transform)
        }.reject { |points| points.length < 3 },
        normal: transform * face.normal,
        material: face.material,
        back_material: face.back_material,
        layer: face.layer,
        hidden: face.hidden?,
        casts_shadows: face.casts_shadows?,
        receives_shadows: face.receives_shadows?,
        edge_properties: snapshot_face_edge_properties(face, transform)
      }
    end

    def snapshot_face_edge_properties(face, transform)
      properties = {}

      face.loops.each do |loop|
        loop.edges.each do |edge|
          key = edge_key(
            edge.start.position.transform(transform),
            edge.end.position.transform(transform)
          )
          properties[key] ||= snapshot_edge_properties(edge)
        end
      end

      properties
    end

    def snapshot_edge_geometry(edge, transform)
      {
        start: edge.start.position.transform(transform),
        end: edge.end.position.transform(transform)
      }.merge(snapshot_edge_properties(edge))
    end

    def snapshot_edge_properties(edge)
      {
        layer: edge.layer,
        material: edge.material,
        hidden: edge.hidden?,
        soft: edge.soft?,
        smooth: edge.smooth?,
        casts_shadows: edge.casts_shadows?,
        receives_shadows: edge.receives_shadows?
      }
    end

    def loop_points(loop, transform)
      loop.vertices.map { |vertex|
        vertex.position.transform(transform)
      }
    end

    def apply_face_properties(face, properties)
      face.material = properties[:material] if properties[:material]
      face.back_material = properties[:back_material] if properties[:back_material]
      face.layer = properties[:layer] if properties[:layer]
      face.hidden = properties[:hidden] if face.respond_to?(:hidden=)
      face.casts_shadows = properties[:casts_shadows] if face.respond_to?(:casts_shadows=)
      face.receives_shadows = properties[:receives_shadows] if face.respond_to?(:receives_shadows=)
    rescue StandardError
      nil
    end

    def apply_edge_properties(edge, properties)
      edge.layer = properties[:layer] if properties[:layer]
      edge.material = properties[:material] if properties[:material]
      edge.hidden = properties[:hidden] if edge.respond_to?(:hidden=)
      edge.soft = properties[:soft]
      edge.smooth = properties[:smooth]
      edge.casts_shadows = properties[:casts_shadows] if edge.respond_to?(:casts_shadows=)
      edge.receives_shadows = properties[:receives_shadows] if edge.respond_to?(:receives_shadows=)
    rescue StandardError
      nil
    end

    def apply_face_edge_properties(face, edge_properties)
      face.edges.each do |edge|
        key = edge_key(edge.start.position, edge.end.position)
        properties = edge_properties[key]
        next unless properties

        apply_edge_properties(edge, properties)
      end
    end

    def edge_key(point1, point2)
      keys = [point_key(point1), point_key(point2)].sort
      keys.join('|')
    end

    def point_key(point)
      [
        point.x.to_f.round(9),
        point.y.to_f.round(9),
        point.z.to_f.round(9)
      ].join(',')
    end

    def plane_frame_points(plane, center, half_size)
      normal = plane_normal(plane)
      xaxis, yaxis = plane_axes(normal)

      p1 = center.offset(xaxis, half_size).offset(yaxis, half_size)
      p2 = center.offset(xaxis.reverse, half_size).offset(yaxis, half_size)
      p3 = center.offset(xaxis.reverse, half_size).offset(yaxis.reverse, half_size)
      p4 = center.offset(xaxis, half_size).offset(yaxis.reverse, half_size)
      [p1, p2, p3, p4]
    end

    def plane_axes(normal)
      reference = Z_AXIS
      reference = X_AXIS if normal.cross(reference).length <= EPSILON

      xaxis = normal.cross(reference)
      xaxis.length = 1.0
      yaxis = normal.cross(xaxis)
      yaxis.length = 1.0
      [xaxis, yaxis]
    end

    def trim_piece(instance, plane, keep_side, plane_group)
      return unless instance&.valid?

      instance.make_unique if instance.respond_to?(:make_unique)
      make_unique_nested(instance, instance.transformation, plane)
      nested_intersect(instance, instance.transformation, plane_group)
      prune_piece(instance, instance.transformation, plane, keep_side)
    end

    def trim_middle_piece(instance, left_plane, right_plane, left_plane_group, right_plane_group)
      return unless instance&.valid?

      instance.make_unique if instance.respond_to?(:make_unique)
      make_unique_nested(instance, instance.transformation, left_plane)
      make_unique_nested(instance, instance.transformation, right_plane)
      nested_intersect(instance, instance.transformation, left_plane_group)
      nested_intersect(instance, instance.transformation, right_plane_group)
      prune_piece(instance, instance.transformation, left_plane, :positive, false)
      prune_piece(instance, instance.transformation, right_plane, :negative, false) if instance.valid?
      if instance.valid?
        entities = get_entities(instance)
        cap_cut_openings(entities, instance.transformation, left_plane)
        cap_cut_openings(entities, instance.transformation, right_plane)
      end
    end

    def nested_intersect(instance, transform, plane_group)
      entities = get_entities(instance)
      entities.each do |entity|
        next unless entity.valid? && entity.visible?
        next unless entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
        nested_intersect(entity, transform * entity.transformation, plane_group)
      end

      intersect_entities(instance, transform, plane_group)
    end

    def intersect_entities(instance, transform, plane_group)
      return unless has_intersectable_raw_geometry?(instance)
      return unless intersects_plane?(instance, transform, plane_group)

      entities = get_entities(instance)
      entities.intersect_with(false, transform, entities, transform, false, [plane_group])
    end

    def intersects_plane?(instance, transform, plane_group)
      return false unless has_intersectable_raw_geometry?(instance)

      if @helper_group.nil? || !@helper_group.valid?
        @helper_group = Sketchup.active_model.active_entities.add_group
        @helper_group.entities.add_cpoint(ORIGIN)
      end

      test_edges = get_entities(instance).intersect_with(
        false,
        transform,
        @helper_group.entities,
        @helper_group.transformation,
        false,
        [plane_group]
      )
      !test_edges.empty?
    end

    def has_intersectable_raw_geometry?(instance)
      entities = get_entities(instance)
      return false unless entities

      entities.any? { |entity|
        entity.valid? &&
          entity.visible? &&
          (entity.is_a?(Sketchup::Face) || entity.is_a?(Sketchup::Edge))
      }
    end

    def make_unique_nested(instance, transform, plane)
      get_entities(instance).each do |entity|
        next unless entity.valid? && entity.visible?
        next unless entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)

        relation = bounds_plane_relation(entity, transform * entity.transformation, plane)
        next unless relation == :straddle

        entity.make_unique
        make_unique_nested(entity, transform * entity.transformation, plane)
      end
    end

    def prune_piece(instance, transform, plane, keep_side, cap_after = true)
      entities = get_entities(instance)
      doomed_instances = []

      entities.each do |entity|
        next unless entity.valid? && entity.visible?

        if entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
          child_transform = transform * entity.transformation
          relation = bounds_plane_relation(entity, child_transform, plane)
          if relation == :straddle
            prune_piece(entity, child_transform, plane, keep_side, cap_after)
          elsif remove_relation?(relation, keep_side)
            doomed_instances << entity
          end
        end
      end

      entities.erase_entities(doomed_instances) unless doomed_instances.empty?
      prune_raw_geometry(entities, transform, plane, keep_side)
      cap_cut_openings(entities, transform, plane) if cap_after
    end

    def remove_relation?(relation, keep_side)
      case keep_side
      when :negative
        relation == :positive
      when :positive
        relation == :negative
      else
        false
      end
    end

    def prune_raw_geometry(entities, transform, plane, keep_side)
      doomed = []

      entities.each do |entity|
        next unless entity.valid?

        case entity
        when Sketchup::Face
          centroid = face_centroid(entity, transform)
          value = signed_distance(plane, centroid)
          doomed << entity if remove_signed_distance?(value, keep_side)
        when Sketchup::Edge
          midpoint = edge_midpoint(entity, transform)
          value = signed_distance(plane, midpoint)
          doomed << entity if remove_signed_distance?(value, keep_side) && value.abs > EPSILON
        when Sketchup::ConstructionPoint
          point = entity.position.transform(transform)
          value = signed_distance(plane, point)
          doomed << entity if remove_signed_distance?(value, keep_side)
        end
      end

      entities.erase_entities(doomed) unless doomed.empty?
    end

    def prune_raw_gap_geometry(entities, left_plane, right_plane)
      doomed = []

      entities.each do |entity|
        next unless entity.valid?
        next if entity == @helper_group
        next unless entity.visible?
        next if entity.respond_to?(:locked?) && entity.locked?

        case entity
        when Sketchup::Face
          centroid = face_centroid(entity, Geom::Transformation.new)
          doomed << entity if between_planes?(centroid, left_plane, right_plane)
        when Sketchup::Edge
          midpoint = edge_midpoint(entity, Geom::Transformation.new)
          next if on_cut_plane?(midpoint, left_plane, right_plane)
          doomed << entity if between_planes?(midpoint, left_plane, right_plane)
        when Sketchup::ConstructionPoint
          point = entity.position
          doomed << entity if between_planes?(point, left_plane, right_plane)
        end
      end

      entities.erase_entities(doomed) unless doomed.empty?
    end

    def between_planes?(point, left_plane, right_plane)
      signed_distance(left_plane, point) >= -EPSILON &&
        signed_distance(right_plane, point) <= EPSILON
    end

    def on_cut_plane?(point, left_plane, right_plane)
      signed_distance(left_plane, point).abs <= EPSILON ||
        signed_distance(right_plane, point).abs <= EPSILON
    end

    def remove_signed_distance?(value, keep_side)
      case keep_side
      when :negative
        value > EPSILON
      when :positive
        value < -EPSILON
      else
        false
      end
    end

    def cap_cut_openings(entities, transform, plane)
      edges = entities.grep(Sketchup::Edge).select { |edge|
        edge.valid? &&
          edge.faces.length < 2 &&
          edge_on_plane?(edge, transform, plane)
      }

      edges.each { |edge| edge.find_faces if edge.valid? }
    end

    def edge_on_plane?(edge, transform, plane)
      signed_distance(plane, edge.start.position.transform(transform)).abs <= EPSILON &&
        signed_distance(plane, edge.end.position.transform(transform)).abs <= EPSILON
    end

    def face_centroid(face, transform)
      vertices = face.vertices
      sum_x = 0.0
      sum_y = 0.0
      sum_z = 0.0

      vertices.each do |vertex|
        point = vertex.position.transform(transform)
        sum_x += point.x
        sum_y += point.y
        sum_z += point.z
      end

      count = vertices.length.to_f
      Geom::Point3d.new(sum_x / count, sum_y / count, sum_z / count)
    end

    def edge_midpoint(edge, transform)
      start_point = edge.start.position.transform(transform)
      end_point = edge.end.position.transform(transform)
      Geom.linear_combination(0.5, start_point, 0.5, end_point)
    end

    def bounds_plane_relation(instance, transform, plane)
      bounds = instance.bounds
      corners = [
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.max.z)
      ]
      values = corners.map { |point| signed_distance(plane, point.transform(transform)) }

      min_value = values.min
      max_value = values.max

      if min_value < -EPSILON && max_value > EPSILON
        :straddle
      elsif max_value <= EPSILON && min_value >= -EPSILON
        :coplanar
      elsif max_value <= EPSILON
        :negative
      else
        :positive
      end
    end

    def instance_empty?(instance)
      get_entities(instance).to_a.none? { |entity|
        entity.is_a?(Sketchup::Face) ||
          entity.is_a?(Sketchup::Edge) ||
          entity.is_a?(Sketchup::Group) ||
          entity.is_a?(Sketchup::ComponentInstance)
      }
    end

    def duplicate_instance(instance)
      parent_entities = Sketchup.active_model.active_entities

      duplicate = if instance.is_a?(Sketchup::Group)
                    instance.copy
                  else
                    parent_entities.add_instance(instance.definition, instance.transformation)
                  end

      duplicate.make_unique
      copy_entity_metadata(instance, duplicate)
      duplicate
    end

    def copy_entity_metadata(source, target)
      return unless source.valid? && target.valid?

      target.name = source.name if source.respond_to?(:name) && target.respond_to?(:name=)
      target.layer = source.layer if source.respond_to?(:layer) && target.respond_to?(:layer=)
      target.material = source.material if source.respond_to?(:material) && target.respond_to?(:material=)
      target.hidden = source.hidden? if target.respond_to?(:hidden=)
      target.casts_shadows = source.casts_shadows? if target.respond_to?(:casts_shadows=)
      target.receives_shadows = source.receives_shadows? if target.respond_to?(:receives_shadows=)
      copy_attributes(source, target)
    rescue StandardError
      nil
    end

    def copy_attributes(source, target)
      return unless source.attribute_dictionaries

      source.attribute_dictionaries.each do |dictionary|
        dictionary.each_pair do |key, value|
          target.set_attribute(dictionary.name, key, value)
        rescue StandardError
          nil
        end
      end
    end

    def delete_helpers
      if @helper_group && @helper_group.valid?
        Sketchup.active_model.active_entities.erase_entities(@helper_group)
      end
      @helper_group = nil
    end

    def get_entities(object)
      case object
      when Sketchup::Group
        object.entities
      when Sketchup::ComponentInstance
        object.definition.entities
      when Sketchup::ComponentDefinition
        object.entities
      when Sketchup::Model
        object.entities
      end
    end

    def plane_from_points(point1, point2, point3)
      vector1 = point2 - point1
      vector2 = point3 - point1
      normal = vector1.cross(vector2)
      return nil if normal.length <= EPSILON

      normal.length = 1.0
      distance = -(normal.x * point1.x + normal.y * point1.y + normal.z * point1.z)
      [normal.x, normal.y, normal.z, distance]
    end

    def plane_normal(plane)
      Geom::Vector3d.new(plane[0], plane[1], plane[2])
    end

    def signed_distance(plane, point)
      plane[0] * point.x + plane[1] * point.y + plane[2] * point.z + plane[3]
    end

    def offset_plane(plane, distance)
      [plane[0], plane[1], plane[2], plane[3] - distance]
    end

    def project_point_to_plane(point, plane)
      point.offset(plane_normal(plane), -signed_distance(plane, point))
    end

  end

  class MultiGapCutTool

    PREVIEW_SIZE = 100.mm

    def initialize(mode)
      @mode = mode
      @ip = Sketchup::InputPoint.new
      @ip1 = Sketchup::InputPoint.new
      @point_a = nil
      @state = 0
      @drawn = false
      @helper_group = nil
      @quantity = 4
      @step = 100.mm
      settings = CCModule::GapCut.read_settings
      @gap_width = settings[:gap_width]
      @baseline_mode = settings[:baseline]
      @start_mode = (Sketchup.read_default("#{PREF_NAMESPACE}.Multi", 'start_mode', 'inward') || 'inward').to_sym
      @end_mode = (Sketchup.read_default("#{PREF_NAMESPACE}.Multi", 'end_mode', 'inward') || 'inward').to_sym
      name = @mode == :distance ? 'multi_gap_cut_distance' : 'multi_gap_cut_quantity'
      @cursor = UI.create_cursor(File.join(File.dirname(__FILE__), 'images', "#{name}.png"), 1, 1)
    end

    def activate
      @ip.clear
      @ip1.clear if @ip1
      @point_a = nil
      @state = 0
      @drawn = false
      update_status
    end

    def deactivate(view)
      view.invalidate if @drawn
    end

    def onSetCursor
      UI.set_cursor(@cursor)
    end

    def enableVCB?
      true
    end

    def onMouseMove(_flags, x, y, view)
      if @state == 1 && @ip1&.valid?
        @ip.pick(view, x, y, @ip1)
      else
        @ip.pick(view, x, y)
      end
      view.tooltip = @ip.tooltip if @ip.valid?
      view.invalidate
    end

    def onLButtonDown(_flags, x, y, view)
      if @state == 1 && @ip1&.valid?
        @ip.pick(view, x, y, @ip1)
      else
        @ip.pick(view, x, y)
      end
      return unless @ip.valid?

      case @state
      when 0
        @point_a = Geom::Point3d.new(@ip.position.x, @ip.position.y, @ip.position.z)
        @ip1 = Sketchup::InputPoint.new
        @ip1.copy!(@ip)
        @state = 1
      when 1
        perform_multi_cut
        reset(view)
      end

      update_status
      view.invalidate
    end

    def onCancel(_flag, view)
      reset(view)
    end

    def onUserText(text, view)
      if @mode == :distance
        @step = CCModule::GapCut.parse_length(text)
        if @step <= EPSILON
          UI.beep
          Sketchup.set_status_text('间距必须大于 0。', SB_PROMPT)
          return
        end
      else
        count = text.to_i
        if count < 1
          UI.beep
          Sketchup.set_status_text('段数必须大于 0。', SB_PROMPT)
          return
        end
        @quantity = count
      end
      update_status
      view.invalidate if view
    rescue ArgumentError
      UI.beep
      Sketchup.set_status_text('无法识别输入。', SB_PROMPT)
    end

    def draw(view)
      draw_input_point(view, @ip1)
      draw_input_point(view, @ip)

      return unless @point_a

      point_b = @state == 1 && @ip.valid? ? @ip.position : @point_a

      draw_polyline(view, [@point_a, point_b], Sketchup::Color.new(255, 180, 80), 3)

      positions = compute_cut_positions(@point_a, point_b)
      return if positions.empty?

      direction = (point_b - @point_a).normalize
      return unless direction

      positions.each_with_index do |pos, idx|
        draw_cut_preview(view, pos, direction, idx, positions.length)
      end

      @drawn = true
    end

    def getExtents
      box = Sketchup.active_model.bounds
      box.add(@point_a) if @point_a
      box.add(@ip.position) if @ip.valid?
      box
    end

    def getMenu(menu, *_args)
      view = Sketchup.active_model.active_view

      menu.add_item("基线位置: #{BASELINE_LEFT}#{@baseline_mode == BASELINE_LEFT ? '  当前' : ''}") {
        @baseline_mode = BASELINE_LEFT
        Sketchup.write_default(PREF_NAMESPACE, PREF_BASELINE, BASELINE_LEFT)
        update_status
        view.invalidate
      }
      menu.add_item("基线位置: #{BASELINE_CENTER}#{@baseline_mode == BASELINE_CENTER ? '  当前' : ''}") {
        @baseline_mode = BASELINE_CENTER
        Sketchup.write_default(PREF_NAMESPACE, PREF_BASELINE, BASELINE_CENTER)
        update_status
        view.invalidate
      }
      menu.add_item("基线位置: #{BASELINE_RIGHT}#{@baseline_mode == BASELINE_RIGHT ? '  当前' : ''}") {
        @baseline_mode = BASELINE_RIGHT
        Sketchup.write_default(PREF_NAMESPACE, PREF_BASELINE, BASELINE_RIGHT)
        update_status
        view.invalidate
      }

      menu.add_separator

      mode_names = { inward: '内收', center: '居中', none: '不切割' }
      sub = menu.add_submenu('起点处理')
      mode_names.each do |key, label|
        sub.add_item("#{label}#{@start_mode == key ? '  当前' : ''}") {
          @start_mode = key
          Sketchup.write_default("#{PREF_NAMESPACE}.Multi", 'start_mode', key.to_s)
          update_status
          view.invalidate
        }
      end

      sub = menu.add_submenu('终点处理')
      mode_names.each do |key, label|
        sub.add_item("#{label}#{@end_mode == key ? '  当前' : ''}") {
          @end_mode = key
          Sketchup.write_default("#{PREF_NAMESPACE}.Multi", 'end_mode', key.to_s)
          update_status
          view.invalidate
        }
      end

      menu.add_separator

      menu.add_item('多开缝切割设置...') {
        values = UI.inputbox(['缝隙宽度', '间距/段数'], [CCModule::GapCut.format_length(@gap_width), @mode == :distance ? CCModule::GapCut.format_length(@step) : @quantity.to_s], ['', ''], '多开缝切割设置')
        if values
          width = CCModule::GapCut.parse_length(values[0])
          if @mode == :distance
            @step = CCModule::GapCut.parse_length(values[1])
          else
            @quantity = values[1].to_i
          end
          @gap_width = width
          update_status
          view.invalidate
        end
      }
    rescue ArgumentError
      UI.beep
    end

    private

    def compute_cut_positions(a, b)
      vec = b - a
      length = vec.length
      return [] if length <= EPSILON

      case @mode
      when :distance
        positions = []
        dir = vec.clone
        dir.length = @step
        pos = Geom::Point3d.new(a)
        while pos.distance(a) <= length
          positions << pos
          pos = pos.offset(dir)
        end
        positions
      when :quantity
        return [] if @quantity < 1
        step_vec = vec.clone
        step_vec.length = length / @quantity.to_f
        pts = []
        (@quantity + 1).times do |i|
          pts << Geom::Point3d.new(a.x + step_vec.x * i, a.y + step_vec.y * i, a.z + step_vec.z * i)
        end
        pts
      end
    end

    def baseline_for_index(idx, total)
      if idx == 0
        case @start_mode
        when :inward then BASELINE_LEFT
        when :center then @baseline_mode
        when :none then nil
        else @baseline_mode
        end
      elsif idx == total - 1
        case @end_mode
        when :inward then BASELINE_RIGHT
        when :center then @baseline_mode
        when :none then nil
        else @baseline_mode
        end
      else
        @baseline_mode
      end
    end

    def draw_cut_preview(view, position, direction, idx, total)
      _, yaxis = plane_axes(direction)
      xaxis = direction.cross(yaxis)
      xaxis.length = 1.0

      half = PREVIEW_SIZE / 2.0
      corners = ->(center) {
        [
          center.offset(xaxis, half).offset(yaxis, half),
          center.offset(xaxis.reverse, half).offset(yaxis, half),
          center.offset(xaxis.reverse, half).offset(yaxis.reverse, half),
          center.offset(xaxis, half).offset(yaxis.reverse, half),
          center.offset(xaxis, half).offset(yaxis, half)
        ]
      }

      baseline = baseline_for_index(idx, total)

      draw_polyline(view, corners.call(position), Sketchup::Color.new(80, 180, 255), 1)
      return unless baseline

      left_offset, right_offset = baseline_offsets(baseline)
      draw_polyline(view, corners.call(position.offset(direction, left_offset)), Sketchup::Color.new(90, 190, 255, 120), 1)
      draw_polyline(view, corners.call(position.offset(direction, right_offset)), Sketchup::Color.new(90, 190, 255, 120), 1)
    end

    def perform_multi_cut
      point_b = @ip.position
      positions = compute_cut_positions(@point_a, point_b)
      return if positions.empty?

      dir = (point_b - @point_a).normalize
      return unless dir

      model = Sketchup.active_model
      explicit_targets = explicit_selected_targets
      selected_loose = selected_loose_entities
      targets = editable_targets.dup
      context_mode = false
      cut_context_loose = false
      transient_context_targets = []

      if targets.empty? && selected_loose.empty?
        unless selection_entities.empty?
          show_selection_error
          return
        end
        unless context_cut_entities.any?
          show_selection_error
          return
        end
        result = UI.messagebox('当前没有选中对象，将对当前编辑层中的所有物体执行多开缝切割，是否继续？', MB_YESNO)
        return unless result == IDYES
        context_mode = true
      end

      if context_mode
        entities = context_cut_entities
        targets = entities.select { |e|
          e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
        }
        cut_context_loose = entities.any? { |e|
          e.is_a?(Sketchup::Face) || e.is_a?(Sketchup::Edge)
        }
        raise '当前层中没有可用于整体切割的实体。' if targets.empty? && !cut_context_loose
      end

      model.start_operation('多开缝切割', true)
      active_entities = model.active_entities

      if selected_loose.any?
        selection_source = build_transient_loose_source(active_entities, selected_loose, "#{TOOL_NAME}_Selection")
        if selection_source
          targets << selection_source
          transient_context_targets << selection_source
        end
      end

      if context_mode && cut_context_loose && top_level_context?
        context_source = build_transient_loose_source(active_entities, loose_intersect_targets, "#{TOOL_NAME}_Loose")
        if context_source
          targets << context_source
          transient_context_targets << context_source
          cut_context_loose = false
        end
      end

      new_selection = []
      transient_pieces = []
      skipped = context_mode ? 0 : (explicit_targets.length - editable_targets.length)

      begin
        positions.each_with_index do |pos, idx|
          baseline = baseline_for_index(idx, positions.length)
          next unless baseline

          left_offset, right_offset = baseline_offsets(baseline)
          plane = [dir.x, dir.y, dir.z, -(dir.x * pos.x + dir.y * pos.y + dir.z * pos.z)]
          left_plane = offset_plane(plane, left_offset)
          right_plane = offset_plane(plane, right_offset)

          bounds = Geom::BoundingBox.new
          targets.each { |t| add_bounds_to_box(bounds, t.bounds) if t.valid? }

          left_group = create_plane_group(active_entities, left_plane, bounds)
          right_group = create_plane_group(active_entities, right_plane, bounds)

          next_targets = []

          targets.each do |target|
            next unless target.valid?
            next if target.respond_to?(:locked?) && target.locked?

            explode_after = transient_context_targets.include?(target)
            negative = duplicate_instance(target)
            positive = target

            trim_piece(negative, left_plane, :negative, left_group)
            trim_piece(positive, right_plane, :positive, right_group)

            [negative, positive].each do |piece|
              next unless piece&.valid?
              if instance_empty?(piece)
                piece.erase!
              else
                next_targets << piece
                transient_pieces << piece if explode_after
              end
            end
          end

          cleanup_entities([left_group, right_group])
          targets = next_targets
        end

        if transient_pieces.any?
          new_selection.concat(rebuild_group_pieces_as_loose_geometry(transient_pieces))
        end

        new_selection.concat(targets.reject { |t| transient_pieces.include?(t) })
        new_selection = new_selection.select { |e| e.is_a?(Sketchup::Entity) && e.valid? }
        model.selection.clear
        model.selection.add(new_selection) unless new_selection.empty?
        model.commit_operation

        if skipped > 0
          UI.messagebox("已跳过 #{skipped} 个锁定对象。")
        end
      rescue => e
        model.abort_operation
        delete_helpers
        UI.messagebox("多开缝切割失败:\n#{e.message}\n#{e.backtrace.first(5).join("\n")}")
      end
    end

    def collect_targets
      Sketchup.active_model.selection.select { |e|
        e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
      }.reject { |e|
        e.respond_to?(:locked?) && e.locked?
      }
    end

    def baseline_offsets(baseline)
      case baseline
      when BASELINE_LEFT
        [0.0, @gap_width]
      when BASELINE_RIGHT
        [-@gap_width, 0.0]
      else
        [-@gap_width / 2.0, @gap_width / 2.0]
      end
    end

    def offset_plane(plane, distance)
      [plane[0], plane[1], plane[2], plane[3] - distance]
    end

    def plane_axes(normal)
      reference = Z_AXIS
      reference = X_AXIS if normal.cross(reference).length <= EPSILON
      xaxis = normal.cross(reference)
      xaxis.length = 1.0
      yaxis = normal.cross(xaxis)
      yaxis.length = 1.0
      [xaxis, yaxis]
    end

    def create_plane_group(entities, plane, bounds)
      group = entities.add_group
      normal = Geom::Vector3d.new(plane[0], plane[1], plane[2])
      _, yaxis = plane_axes(normal)
      xaxis = normal.cross(yaxis)
      xaxis.length = 1.0
      center = bounds.valid? && !bounds.empty? ? bounds.center : ORIGIN
      center = center.offset(normal, -signed_distance(plane, center))
      half_size = [bounds.valid? && !bounds.empty? ? bounds.diagonal : 1.inch, @gap_width, 100.mm].max
      p1 = center.offset(xaxis, half_size).offset(yaxis, half_size)
      p2 = center.offset(xaxis.reverse, half_size).offset(yaxis, half_size)
      p3 = center.offset(xaxis.reverse, half_size).offset(yaxis.reverse, half_size)
      p4 = center.offset(xaxis, half_size).offset(yaxis.reverse, half_size)
      group.entities.add_face([p1, p2, p3, p4])
      group
    end

    def trim_piece(instance, plane, keep_side, plane_group)
      return unless instance&.valid?
      instance.make_unique if instance.respond_to?(:make_unique)
      make_unique_nested(instance, instance.transformation, plane)
      nested_intersect(instance, instance.transformation, plane_group)
      prune_piece(instance, instance.transformation, plane, keep_side)
    end

    def make_unique_nested(instance, transform, plane)
      get_entities(instance).each do |entity|
        next unless entity.valid? && entity.visible?
        next unless entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
        relation = bounds_plane_relation(entity, transform * entity.transformation, plane)
        next unless relation == :straddle
        entity.make_unique
        make_unique_nested(entity, transform * entity.transformation, plane)
      end
    end

    def nested_intersect(instance, transform, plane_group)
      entities = get_entities(instance)
      entities.each do |entity|
        next unless entity.valid? && entity.visible?
        next unless entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
        nested_intersect(entity, transform * entity.transformation, plane_group)
      end
      intersect_entities(instance, transform, plane_group)
    end

    def intersect_entities(instance, transform, plane_group)
      return unless has_intersectable_raw_geometry?(instance)
      return unless intersects_plane?(instance, transform, plane_group)
      entities = get_entities(instance)
      entities.intersect_with(false, transform, entities, transform, false, [plane_group])
    end

    def intersects_plane?(instance, transform, plane_group)
      return false unless has_intersectable_raw_geometry?(instance)
      if @helper_group.nil? || !@helper_group.valid?
        @helper_group = Sketchup.active_model.active_entities.add_group
        @helper_group.entities.add_cpoint(ORIGIN)
      end
      test_edges = get_entities(instance).intersect_with(
        false, transform,
        @helper_group.entities, @helper_group.transformation,
        false, [plane_group]
      )
      !test_edges.empty?
    end

    def has_intersectable_raw_geometry?(instance)
      entities = get_entities(instance)
      return false unless entities
      entities.any? { |entity|
        entity.valid? && entity.visible? &&
          (entity.is_a?(Sketchup::Face) || entity.is_a?(Sketchup::Edge))
      }
    end

    def prune_piece(instance, transform, plane, keep_side, cap_after = true)
      entities = get_entities(instance)
      doomed_instances = []
      entities.each do |entity|
        next unless entity.valid? && entity.visible?
        if entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
          child_transform = transform * entity.transformation
          relation = bounds_plane_relation(entity, child_transform, plane)
          if relation == :straddle
            prune_piece(entity, child_transform, plane, keep_side, cap_after)
          elsif remove_relation?(relation, keep_side)
            doomed_instances << entity
          end
        end
      end
      entities.erase_entities(doomed_instances) unless doomed_instances.empty?
      prune_raw_geometry(entities, transform, plane, keep_side)
      cap_cut_openings(entities, transform, plane) if cap_after
    end

    def remove_relation?(relation, keep_side)
      case keep_side
      when :negative then relation == :positive
      when :positive then relation == :negative
      else false
      end
    end

    def prune_raw_geometry(entities, transform, plane, keep_side)
      doomed = []
      entities.each do |entity|
        next unless entity.valid?
        case entity
        when Sketchup::Face
          centroid = face_centroid(entity, transform)
          doomed << entity if remove_signed_distance?(signed_distance(plane, centroid), keep_side)
        when Sketchup::Edge
          midpoint = edge_midpoint(entity, transform)
          value = signed_distance(plane, midpoint)
          doomed << entity if remove_signed_distance?(value, keep_side) && value.abs > EPSILON
        when Sketchup::ConstructionPoint
          doomed << entity if remove_signed_distance?(signed_distance(plane, entity.position.transform(transform)), keep_side)
        end
      end
      entities.erase_entities(doomed) unless doomed.empty?
    end

    def remove_signed_distance?(value, keep_side)
      case keep_side
      when :negative then value > EPSILON
      when :positive then value < -EPSILON
      else false
      end
    end

    def cap_cut_openings(entities, transform, plane)
      edges = entities.grep(Sketchup::Edge).select { |edge|
        edge.valid? && edge.faces.length < 2 && edge_on_plane?(edge, transform, plane)
      }
      edges.each { |edge| edge.find_faces if edge.valid? }
    end

    def edge_on_plane?(edge, transform, plane)
      signed_distance(plane, edge.start.position.transform(transform)).abs <= EPSILON &&
        signed_distance(plane, edge.end.position.transform(transform)).abs <= EPSILON
    end

    def duplicate_instance(instance)
      parent_entities = Sketchup.active_model.active_entities
      duplicate = if instance.is_a?(Sketchup::Group)
                    instance.copy
                  else
                    parent_entities.add_instance(instance.definition, instance.transformation)
                  end
      duplicate.make_unique
      duplicate
    end

    def instance_empty?(instance)
      get_entities(instance).to_a.none? { |entity|
        entity.is_a?(Sketchup::Face) || entity.is_a?(Sketchup::Edge) ||
          entity.is_a?(Sketchup::Group) || entity.is_a?(Sketchup::ComponentInstance)
      }
    end

    def get_entities(object)
      case object
      when Sketchup::Group then object.entities
      when Sketchup::ComponentInstance then object.definition.entities
      when Sketchup::ComponentDefinition then object.entities
      when Sketchup::Model then object.entities
      end
    end

    def selection_entities
      Sketchup.active_model.selection.to_a
    end

    def explicit_selected_targets
      selection_entities.select { |e|
        e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
      }
    end

    def editable_targets
      explicit_selected_targets.reject(&:locked?)
    end

    def selected_loose_entities
      selection_entities.select { |e| loose_geometry_entity?(e) }
    end

    def loose_geometry_entity?(entity)
      return false unless entity&.valid?
      return false unless entity.visible?
      return false if entity.respond_to?(:locked?) && entity.locked?
      entity.is_a?(Sketchup::Face) ||
        (entity.is_a?(Sketchup::Edge) && entity.faces.empty?)
    end

    def context_cut_entities
      entities = visible_unlocked_context_entities
      instances = entities.select { |e|
        e.is_a?(Sketchup::Group) || e.is_a?(Sketchup::ComponentInstance)
      }
      faces = entities.grep(Sketchup::Face)
      free_edges = entities.grep(Sketchup::Edge).select { |e| e.faces.empty? }
      instances + faces + free_edges
    end

    def visible_unlocked_context_entities
      Sketchup.active_model.active_entities.to_a.select { |entity|
        next false unless entity.valid?
        next false if entity == @helper_group
        next false if entity.is_a?(Sketchup::SectionPlane)
        next false if entity.respond_to?(:locked?) && entity.locked?
        next false unless entity.visible?
        true
      }
    end

    def loose_intersect_targets
      visible_unlocked_context_entities.select { |e| loose_geometry_entity?(e) }
    end

    def top_level_context?
      Sketchup.active_model.active_path.nil?
    end

    def show_selection_error
      if !explicit_selected_targets.empty? && editable_targets.empty? && selected_loose_entities.empty?
        UI.messagebox('当前选中的组/组件已锁定，请先解锁后再执行开缝切割。')
      elsif !selection_entities.empty? && (explicit_selected_targets + selected_loose_entities).empty?
        UI.messagebox('当前选中的对象不支持开缝切割。请选择组/组件、零散面或独立边。')
      elsif context_cut_entities.empty?
        UI.messagebox('当前编辑层中没有可切割的对象。')
      else
        UI.messagebox('当前没有选中可切割对象。继续操作时，会提示你是否对当前层中的所有物体执行多开缝切割。')
      end
    end

    def build_transient_loose_source(entities, loose_entities, name)
      snapshots = snapshot_loose_entities(loose_entities)
      return nil if snapshots.empty?

      removable = removable_loose_entities(loose_entities)
      entities.erase_entities(removable) unless removable.empty?

      group = entities.add_group
      group.name = name
      build_loose_geometry_from_snapshots(group.entities, snapshots)
      group
    end

    def removable_loose_entities(loose_entities)
      faces = loose_entities.grep(Sketchup::Face).uniq.select(&:valid?)
      free_edges = loose_entities.grep(Sketchup::Edge).uniq.select(&:valid?)
      removable = faces.dup.concat(free_edges)
      exclusive_face_edges = faces.flat_map(&:edges).uniq.select { |edge|
        edge.valid? && (edge.faces - faces).empty?
      }
      removable.concat(exclusive_face_edges)
      removable.uniq
    end

    def snapshot_loose_entities(loose_entities)
      faces = loose_entities.grep(Sketchup::Face).uniq.filter_map { |face|
        snapshot_face_geometry(face, Geom::Transformation.new)
      }
      free_edges = loose_entities.grep(Sketchup::Edge).uniq.select { |e|
        e.faces.empty?
      }.filter_map { |edge|
        snapshot_edge_geometry(edge, Geom::Transformation.new)
      }
      return [] if faces.empty? && free_edges.empty?
      [{ faces: faces, free_edges: free_edges }]
    end

    def snapshot_face_geometry(face, transform)
      outer = loop_points(face.outer_loop, transform)
      return nil if outer.length < 3
      {
        outer: outer,
        holes: face.loops.reject(&:outer?).map { |loop| loop_points(loop, transform) }.reject { |p| p.length < 3 },
        normal: transform * face.normal,
        material: face.material,
        back_material: face.back_material,
        layer: face.layer,
        hidden: face.hidden?,
        casts_shadows: face.casts_shadows?,
        receives_shadows: face.receives_shadows?,
        edge_properties: snapshot_face_edge_properties(face, transform)
      }
    end

    def snapshot_face_edge_properties(face, transform)
      properties = {}
      face.loops.each do |loop|
        loop.edges.each do |edge|
          key = edge_key(
            edge.start.position.transform(transform),
            edge.end.position.transform(transform)
          )
          properties[key] ||= {
            layer: edge.layer, material: edge.material, hidden: edge.hidden?,
            soft: edge.soft?, smooth: edge.smooth?,
            casts_shadows: edge.casts_shadows?, receives_shadows: edge.receives_shadows?
          }
        end
      end
      properties
    end

    def snapshot_edge_geometry(edge, transform)
      {
        start: edge.start.position.transform(transform),
        end: edge.end.position.transform(transform),
        layer: edge.layer, material: edge.material, hidden: edge.hidden?,
        soft: edge.soft?, smooth: edge.smooth?,
        casts_shadows: edge.casts_shadows?, receives_shadows: edge.receives_shadows?
      }
    end

    def loop_points(loop, transform)
      loop.vertices.map { |v| v.position.transform(transform) }
    end

    def edge_key(point1, point2)
      [point_key(point1), point_key(point2)].sort.join('|')
    end

    def point_key(point)
      [point.x.to_f.round(9), point.y.to_f.round(9), point.z.to_f.round(9)].join(',')
    end

    def rebuild_group_pieces_as_loose_geometry(pieces)
      snapshots = pieces.filter_map { |piece| snapshot_loose_geometry_piece(piece) }
      cleanup_entities(pieces)
      return [] if snapshots.empty?
      entities = Sketchup.active_model.active_entities
      build_loose_geometry_from_snapshots(entities, snapshots)
    end

    def snapshot_loose_geometry_piece(instance)
      return nil unless instance&.valid?
      ents = get_entities(instance)
      return nil unless ents
      transform = instance.transformation
      {
        faces: ents.grep(Sketchup::Face).filter_map { |f| snapshot_face_geometry(f, transform) },
        free_edges: ents.grep(Sketchup::Edge).select { |e| e.faces.empty? }.filter_map { |e| snapshot_edge_geometry(e, transform) }
      }
    end

    def build_loose_geometry_from_snapshots(entities, snapshots)
      created = []
      face_records = []
      entities.build { |builder|
        snapshots.each do |snapshot|
          snapshot[:faces].each do |data|
            face = data[:holes].empty? ? builder.add_face(data[:outer]) : builder.add_face(data[:outer], holes: data[:holes])
            next unless face
            apply_face_properties(face, data)
            face_records << [face, data]
            created << face
          end
          snapshot[:free_edges].each do |data|
            edge = builder.add_edge(data[:start], data[:end])
            next unless edge
            apply_edge_properties(edge, data)
            created << edge
          end
        end
      }
      face_records.each do |face, data|
        next unless face.valid?
        face.reverse! unless face.normal.samedirection?(data[:normal])
        data[:edge_properties].each do |key, props|
          face.edges.each do |edge|
            ek = edge_key(edge.start.position, edge.end.position)
            apply_edge_properties(edge, props) if ek == key
          end
        end
      end
      created.uniq.select(&:valid?)
    end

    def apply_face_properties(face, data)
      face.material = data[:material] if data[:material]
      face.back_material = data[:back_material] if data[:back_material]
      face.layer = data[:layer] if data[:layer]
      face.hidden = data[:hidden] if face.respond_to?(:hidden=)
      face.casts_shadows = data[:casts_shadows] if face.respond_to?(:casts_shadows=)
      face.receives_shadows = data[:receives_shadows] if face.respond_to?(:receives_shadows=)
    rescue StandardError
      nil
    end

    def apply_edge_properties(edge, data)
      edge.layer = data[:layer] if data[:layer]
      edge.material = data[:material] if data[:material]
      edge.hidden = data[:hidden] if edge.respond_to?(:hidden=)
      edge.soft = data[:soft]
      edge.smooth = data[:smooth]
      edge.casts_shadows = data[:casts_shadows] if edge.respond_to?(:casts_shadows=)
      edge.receives_shadows = data[:receives_shadows] if edge.respond_to?(:receives_shadows=)
    rescue StandardError
      nil
    end

    def cleanup_entities(entities)
      list = entities.compact.select { |e| e.valid? }
      Sketchup.active_model.active_entities.erase_entities(list) unless list.empty?
    end

    def delete_helpers
      if @helper_group && @helper_group.valid?
        Sketchup.active_model.active_entities.erase_entities(@helper_group)
      end
      @helper_group = nil
    end

    def add_bounds_to_box(box, bounds)
      corners = [
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.max.z)
      ]
      corners.each { |pt| box.add(pt) }
    end

    def bounds_plane_relation(instance, transform, plane)
      bounds = instance.bounds
      corners = [
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.min.x, bounds.max.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.min.y, bounds.max.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.min.z),
        Geom::Point3d.new(bounds.max.x, bounds.max.y, bounds.max.z)
      ]
      values = corners.map { |pt| signed_distance(plane, pt.transform(transform)) }
      min_val = values.min
      max_val = values.max
      if min_val < -EPSILON && max_val > EPSILON
        :straddle
      elsif max_val <= EPSILON && min_val >= -EPSILON
        :coplanar
      elsif max_val <= EPSILON
        :negative
      else
        :positive
      end
    end

    def face_centroid(face, transform)
      vertices = face.vertices
      count = vertices.length.to_f
      sum_x = 0.0; sum_y = 0.0; sum_z = 0.0
      vertices.each do |v|
        pt = v.position.transform(transform)
        sum_x += pt.x; sum_y += pt.y; sum_z += pt.z
      end
      Geom::Point3d.new(sum_x / count, sum_y / count, sum_z / count)
    end

    def edge_midpoint(edge, transform)
      start = edge.start.position.transform(transform)
      finish = edge.end.position.transform(transform)
      Geom.linear_combination(0.5, start, 0.5, finish)
    end

    def signed_distance(plane, point)
      plane[0] * point.x + plane[1] * point.y + plane[2] * point.z + plane[3]
    end

    def draw_input_point(view, input_point)
      return unless input_point && input_point.valid? && input_point.display?
      input_point.draw(view)
    end

    def draw_polyline(view, points, color, width = 2)
      return if points.length < 2
      view.line_width = width
      view.drawing_color = color
      view.draw(GL_LINE_STRIP, points)
    end

    def update_status
      prompt = case @state
               when 0
                 '选择第 1 个点定义线段起点'
               else
                 '选择第 2 个点定义线段终点'
               end
      mode_text = @mode == :distance ? '定距' : '定量'
      param_text = @mode == :distance ? "间距=#{CCModule::GapCut.format_length(@step)}" : "段数=#{@quantity}"
      gap_text = "缝隙=#{CCModule::GapCut.format_length(@gap_width)}"
      mode_names = { inward: '内收', center: '居中', none: '不切割' }
      offset_text = "起点:#{mode_names[@start_mode]},终点:#{mode_names[@end_mode]}"
      Sketchup.set_status_text("#{mode_text}多开缝: #{prompt}。#{param_text}，#{gap_text}，#{offset_text}。", SB_PROMPT)
      if @mode == :distance
        Sketchup.set_status_text('间距', SB_VCB_LABEL)
        Sketchup.set_status_text(CCModule::GapCut.format_length(@step), SB_VCB_VALUE)
      else
        Sketchup.set_status_text('段数', SB_VCB_LABEL)
        Sketchup.set_status_text(@quantity.to_s, SB_VCB_VALUE)
      end
    end

    def reset(view)
      @point_a = nil
      @state = 0
      @ip.clear
      @ip1.clear if @ip1
      if view
        view.tooltip = nil
        view.invalidate if @drawn
      end
      @drawn = false
    end

  end

  def self.parse_length(value)
    length = value.is_a?(String) ? value.to_l : value.to_f.to_l
    raise ArgumentError, 'invalid length' unless length && length >= 0.0
    length
  end

  def self.format_length(value)
    Sketchup.format_length(parse_length(value))
  rescue ArgumentError
    Sketchup.format_length(DEFAULT_WIDTH)
  end

  def self.read_settings
    width = Sketchup.read_default(PREF_NAMESPACE, PREF_WIDTH, DEFAULT_WIDTH.to_f)
    baseline = Sketchup.read_default(PREF_NAMESPACE, PREF_BASELINE, BASELINE_CENTER).to_s
    baseline = BASELINE_CENTER unless BASELINE_OPTIONS.include?(baseline)

    {
      gap_width: parse_length(width),
      baseline: baseline
    }
  rescue ArgumentError
    {
      gap_width: DEFAULT_WIDTH,
      baseline: BASELINE_CENTER
    }
  end

  def self.write_settings(width, baseline)
    width = parse_length(width)
    baseline = BASELINE_CENTER unless BASELINE_OPTIONS.include?(baseline)

    Sketchup.write_default(PREF_NAMESPACE, PREF_WIDTH, width.to_f)
    Sketchup.write_default(PREF_NAMESPACE, PREF_BASELINE, baseline)

    {
      gap_width: width,
      baseline: baseline
    }
  end

  def self.configure_settings(current = read_settings)
    prompts = ['缝隙宽度', '基线位置']
    defaults = [format_length(current[:gap_width]), current[:baseline]]
    lists = ['', BASELINE_OPTIONS.join('|')]
    values = UI.inputbox(prompts, defaults, lists, '开缝切割设置')
    return nil unless values

    write_settings(values[0], values[1].to_s)
  rescue ArgumentError
    UI.messagebox('缝隙宽度不能为负数。')
    nil
  end

  def self.get_icon(name)
    ext = Sketchup.platform == :platform_osx ? '.png' : '.svg'
    File.join(File.dirname(__FILE__), 'images', name + ext)
  end

  unless file_loaded?(__FILE__)
    plugin_menu = UI.menu('Plugins')
    toolbar = UI::Toolbar.new(PLUGIN_NAME)
    submenu = plugin_menu.add_submenu(PLUGIN_NAME)

    gap_cut_cmd = UI::Command.new(TOOL_NAME) {
      Sketchup.active_model.select_tool(GapCutTool.new)
    }
    gap_cut_cmd.tooltip = TOOL_NAME
    gap_cut_cmd.status_bar_text = '对选中的组/组件执行双切开缝，并为切面封面。'
    gap_cut_cmd.large_icon = gap_cut_cmd.small_icon = get_icon('gap_cut')
    toolbar.add_item(gap_cut_cmd)
    submenu.add_item(gap_cut_cmd)

    multi_cut_distance_cmd = UI::Command.new('定距多开缝') {
      Sketchup.active_model.select_tool(MultiGapCutTool.new(:distance))
    }
    multi_cut_distance_cmd.tooltip = '定距多开缝'
    multi_cut_distance_cmd.status_bar_text = '沿线段以固定间距执行多次开缝切割。'
    multi_cut_distance_cmd.large_icon = multi_cut_distance_cmd.small_icon = get_icon('multi_gap_cut_distance')
    toolbar.add_item(multi_cut_distance_cmd)
    submenu.add_item(multi_cut_distance_cmd)

    multi_cut_quantity_cmd = UI::Command.new('定量多开缝') {
      Sketchup.active_model.select_tool(MultiGapCutTool.new(:quantity))
    }
    multi_cut_quantity_cmd.tooltip = '定量多开缝'
    multi_cut_quantity_cmd.status_bar_text = '将线段等分为N段，在分点处执行开缝切割。'
    multi_cut_quantity_cmd.large_icon = multi_cut_quantity_cmd.small_icon = get_icon('multi_gap_cut_quantity')
    toolbar.add_item(multi_cut_quantity_cmd)
    submenu.add_item(multi_cut_quantity_cmd)

    settings_cmd = UI::Command.new('开缝切割设置...') {
      configure_settings
    }
    settings_cmd.tooltip = '开缝切割设置'
    settings_cmd.status_bar_text = '设置缝隙宽度与左/中/右基线位置。'
    submenu.add_item(settings_cmd)

    case toolbar.get_last_state
    when -1, 1
      toolbar.show
    else
      toolbar.hide
    end

    file_loaded(__FILE__)
  end

  PATH = File.dirname(__FILE__)
  def self.reload
    load(File.join(PATH, 'gap_cut.rb'))
  end

end
