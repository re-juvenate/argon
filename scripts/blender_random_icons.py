# Blender: random icon-per-object shader
#
# Builds a node group ("RandomIconPicker") that shows one of N icon textures,
# chosen randomly per object (Object Info > Random), wired like the classic
# chain in your reference:
#
#   Object Info.Random  ->  Multiply by N  ->  Greater Than (1..N-1)
#                                           ->  sequential Mix chain of images
#
#   random in [0, 1) scaled to [0, N): floor(value) = i  ->  object shows icon i
#
# Then (optionally) assigns a material using the group to every selected
# object, so a scattered pile of cubes/planes each shows a random AWS icon.
#
# Usage:
#   1. Edit ICONS_DIR below (defaults to this repo's icon folder).
#   2. In Blender, Scripting tab -> Open -> Run.
#   3. Select the objects that should wear random icons, re-run (or keep
#      APPLY_TO_SELECTED = True and run once with them selected).
#
# Works in Blender 3.x and 4.x (socket API handled transparently).

import bpy
import os
import glob

# ---------------------------------------------------------------------------
# Config
# ---------------------------------------------------------------------------

# Folder with the icon images (PNG). Use forward slashes on Windows.
ICONS_DIR = r"C:/Users/ppmpr/OneDrive/Documents/GitHub/argon/src/assets/AWS-ICONS/pngs"

# Patterns to pick up (case-insensitive on extension via glob trick not needed;
# pngs folder is all PNG).
PATTERNS = ("*.png",)

# Name of the generated node group and material.
GROUP_NAME = "RandomIconPicker"
MATERIAL_NAME = "RandomIcon"

# Assign a material using the group to all selected mesh objects.
APPLY_TO_SELECTED = True

# Reuse already-loaded images / rebuild the group on re-run.
REBUILD = True

# ---------------------------------------------------------------------------
# Blender 3.x / 4.x compatibility
# ---------------------------------------------------------------------------

def new_socket(group, name, in_out, socket_type):
    """Create a group socket in both the 4.x interface API and the 3.x one."""
    if hasattr(group, "interface"):  # Blender 4.x
        return group.interface.new_socket(name, in_out=in_out, socket_type=socket_type)
    if in_out == "INPUT":
        return group.inputs.new(socket_type, name)
    return group.outputs.new(socket_type, name)


def node_at(tree, node, x, y):
    node.location = (x, y)
    return node


# ---------------------------------------------------------------------------
# Images
# ---------------------------------------------------------------------------

def load_icon_images():
    paths = []
    for pattern in PATTERNS:
        paths.extend(sorted(glob.glob(os.path.join(ICONS_DIR, pattern))))
    if not paths:
        raise RuntimeError(f"No images found in {ICONS_DIR!r} - fix ICONS_DIR and re-run.")

    images = []
    for path in paths:
        img = bpy.data.images.load(path, check_existing=True)
        # Icons are authored in sRGB; keep colors faithful.
        if img.colorspace_settings.name != "sRGB":
            img.colorspace_settings.name = "sRGB"
        images.append(img)
    return images


# ---------------------------------------------------------------------------
# Node group
# ---------------------------------------------------------------------------

def build_group(images):
    n = len(images)

    if REBUILD and GROUP_NAME in bpy.data.node_groups:
        bpy.data.node_groups.remove(bpy.data.node_groups[GROUP_NAME])

    group = bpy.data.node_groups.new(GROUP_NAME, "ShaderNodeTree")
    new_socket(group, "Color", "OUTPUT", "NodeSocketColor")

    nodes, links = group.nodes, group.links

    # Per-object random in [0, 1).
    obj_info = node_at(nodes.new("ShaderNodeObjectInfo"), -800, 0)
    random_out = obj_info.outputs["Random"]

    # Scale to [0, N) - the "Multiply" node from the reference.
    mul = node_at(nodes.new("ShaderNodeMath"), -600, 0)
    mul.operation = "MULTIPLY"
    mul.inputs[1].default_value = float(n)
    links.new(random_out, mul.inputs[0])

    # First icon is the starting state of the Mix chain.
    first_tex = node_at(nodes.new("ShaderNodeTexImage"), -400, -300)
    first_tex.image = images[0]
    prev_out = first_tex.outputs["Color"]

    # Greater Than (i) + Mix for every remaining icon, laid out like the
    # reference screenshot: GT stack on the left of each Mix pair.
    for i in range(1, n):
        x = -400 + (i - 1) * 260

        gt = node_at(nodes.new("ShaderNodeMath"), x, 240 - i * 20)
        gt.operation = "GREATER_THAN"
        gt.label = f"index > {i}"
        gt.inputs[1].default_value = float(i)
        links.new(mul.outputs[0], gt.inputs[0])

        tex = node_at(nodes.new("ShaderNodeTexImage"), x, -260 - i * 40)
        tex.image = images[i]
        tex.label = os.path.splitext(os.path.basename(images[i].filepath))[0]

        mix = node_at(nodes.new("ShaderNodeMixRGB"), x + 130, 0)
        mix.blend_type = "MIX"
        mix.label = f"pick {i}"
        links.new(gt.outputs[0], mix.inputs["Fac"])
        links.new(prev_out, mix.inputs["Color1"])
        links.new(tex.outputs["Color"], mix.inputs["Color2"])

        prev_out = mix.outputs[0]

    # Group output.
    out = node_at(nodes.new("NodeGroupOutput"), 900, 0)
    links.new(prev_out, out.inputs[0])

    return group


# ---------------------------------------------------------------------------
# Material assignment
# ---------------------------------------------------------------------------

def build_material(group):
    mat = bpy.data.materials.get(MATERIAL_NAME)
    if mat is None:
        mat = bpy.data.materials.new(MATERIAL_NAME)
    mat.use_nodes = True
    nt = mat.node_tree
    nt.nodes.clear()

    out = node_at(nt.nodes.new("ShaderNodeOutputMaterial"), 400, 0)
    bsdf = node_at(nt.nodes.new("ShaderNodeBsdfPrincipled"), 100, 0)
    picker = node_at(nt.nodes.new("ShaderNodeGroup"), -250, 0)
    picker.node_tree = group

    nt.links.new(picker.outputs[0], bsdf.inputs["Base Color"])
    nt.links.new(bsdf.outputs[0], out.inputs[0])

    # Icons have transparent corners: render them blended, not opaque-clipped.
    try:  # Blender <= 4.1 (EEVEE legacy)
        mat.blend_method = "BLENDED"
    except Exception:
        pass
    try:  # Blender 4.2+ (EEVEE Next)
        mat.surface_render_method = "BLENDED"
    except Exception:
        pass
    return mat


def assign_to_selected(mat):
    count = 0
    for obj in bpy.context.selected_objects:
        if obj.type != "MESH":
            continue
        # Overwrite any existing RandomIcon slot so re-runs stay clean.
        slot = next((s for s in obj.material_slots if s.material and s.material.name == MATERIAL_NAME), None)
        if slot is None:
            obj.data.materials.append(mat)
        else:
            slot.material = mat
        count += 1
    return count


# ---------------------------------------------------------------------------
# Run
# ---------------------------------------------------------------------------

def main():
    images = load_icon_images()
    group = build_group(images)
    mat = build_material(group)
    assigned = assign_to_selected(mat) if APPLY_TO_SELECTED else 0

    print(f"[RandomIconPicker] {len(images)} icons: {[i.name for i in images]}")
    print(f"[RandomIconPicker] node group '{GROUP_NAME}' + material '{MATERIAL_NAME}' ready.")
    if APPLY_TO_SELECTED:
        print(f"[RandomIconPicker] assigned to {assigned} selected mesh object(s).")
        if assigned == 0:
            print("[RandomIconPicker] nothing selected - select objects and re-run to assign.")


main()
