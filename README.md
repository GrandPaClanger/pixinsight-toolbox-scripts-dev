# Chapel Astro Utilities for PixInsight

> [!WARNING]
> **Beta testers only.** This development repository contains prerelease
> versions that may be incomplete or unstable. For normal production use,
> install Chapel Astro Utilities from the
> [live repository](https://github.com/GrandPaClanger/pixinsight-toolbox-scripts).

PixInsight JavaScript Runtime scripts published through the Chapel Astro
Utilities beta update repository.

PixInsight repository URL:

`https://raw.githubusercontent.com/GrandPaClanger/pixinsight-toolbox-scripts-dev/main/`

Add it in PixInsight:

`Resources > Updates > Manage Repositories`

Then run:

`Resources > Updates > Check for Updates`

Web guide:

`docs/index.html`

Hosted guide:

`https://chapel-astro-utilities-guide.vercel.app/`

## Licence

Copyright (c) 2026 Ian Steane. All rights reserved.

This repository is publicly visible for PixInsight update distribution,
documentation, and end-user access only. No permission is granted to copy,
modify, redistribute, repackage, sell, sublicense, or create derivative works
without prior written permission.

## Menu Location

After installation, scripts appear under:

`Script > Chapel Astro Utilities`

Older installs of `MatchOpenImageSizes` that previously appeared under
`Script > Toolbox` are updated by the new package. The script file path remains
compatible, so it should appear once under the new `Chapel Astro Utilities`
menu after PixInsight refreshes scripts.

## Scripts

### ImageDisplayManager

Menu:

`Script > Chapel Astro Utilities > ImageDisplayManager`

Version:

`1.0.0-beta1`

Purpose:

Combines the display-focused BatchSTFStretch and MatchOpenImageSizes workflows
in one dialog.

- The clearly bordered upper section selects images and applies or resets a
  linked or unlinked automatic ScreenTransferFunction.
- The separate lower section selects a reference image and matches all other
  open images to its zoom, window frame, and pixel dimensions where required.
- A shared refresh control updates both sections when open images change.

### BatchSTFStretch

Menu:

`Script > Chapel Astro Utilities > BatchSTFStretch`

Version:

`1.0.0-beta2`

Purpose:

Applies PixInsight's automatic ScreenTransferFunction stretch to selected open
images without changing their pixel data.

- Select images individually, or use `Select All` and `Select None`.
- Use `Linked` to preserve the relative RGB channel balance.
- Use `Unlinked` to calculate a separate stretch for each RGB channel.
- Use `Reset Screen Transfer` to remove the STF from selected images.

### ImageBatchManager

Menu:

`Script > Chapel Astro Utilities > ImageBatchManager`

Version:

`3.2-beta1`

Purpose:

Renames open image windows and optionally saves images using either filter
mapping rules or a suffix applied to current image identifiers.

#### Rename By Filter Mappings

Use this mode for newly stacked master frames with long generated names.

The mapping table uses:

- `Text to find`: text searched in the current view id, file path, or caption.
- `Rename to`: the PixInsight-safe identifier to use.

Default mappings:

```csv
Nofilter,OSC
Luminance,L
Red,R
Green,G
Blue,B
Sulphur,S
Hydrogen,H
Oxygen,O
```

More specific mappings win. For example, a mapping from `Red_Prestretch` to
`Red_PostStretch` is chosen before a generic `Red` mapping.

#### Append Suffix To Current Names

Use this mode after processing existing renamed images.

Example:

- Current image: `R`
- Suffix: `PreStretch`
- New image: `R_PreStretch`

Suffix values are sanitized for PixInsight identifiers. Invalid characters are
converted to underscores.

#### Preview Selection

The preview lists all open image windows. Checked rows are included in the
operation. Use `Select All` and `Unselect All` to change the batch quickly.

Collapsed/iconized windows are unchecked by default when PixInsight exposes
that state.

#### Save Images After Renaming

When enabled, the script saves renamed images.

The output folder defaults to the source image folder when PixInsight exposes
the path. You can browse to another folder.

Post-save actions:

- Leave selected images open
- Collapse selected images
- Close selected images

Collapsed source images are stacked into a vertical column when PixInsight
exposes writable image-window icon geometry.

`Open newly saved images` appears only when saving is enabled.

In suffix mode, saving creates suffixed copies while preserving the original
open images.

#### Save && Overwrite

`Save && Overwrite` is available after choosing `Save selected images only`
on Step 1 and selecting the images to save on Step 2.

It saves the checked open images to their current image names in their source
folders after one confirmation. For selected images created inside PixInsight
with no source path, it asks for one destination folder and saves those new
images there. It does not rename, close, or collapse images.

### MatchOpenImageSizes

Menu:

`Script > Chapel Astro Utilities > MatchOpenImageSizes`

Version:

`1.0.4`

Purpose:

Matches all other open image windows to a selected reference image window. The
reference window is not changed. The script copies the reference zoom and
attempts to copy the window frame size where PixInsight exposes writable
image-window geometry. Images with different pixel dimensions are resampled to
the reference dimensions.

It also supports PixInsight process icons:

1. Run `Script > Chapel Astro Utilities > MatchOpenImageSizes`.
2. Use the New Instance triangle to drag a process icon to the PixInsight
   workspace.
3. Drag that process icon onto an image window to use it as the reference.

Create the desktop process icon first, then drag that icon onto an image.

After matching, run `ImageBatchManager` separately from the same Chapel Astro
Utilities menu when you are ready to rename the matched images.

## Repository Layout

PixInsight scans scripts under:

`src/scripts/`

Installed scripts:

`src/scripts/Toolbox/ImageRenameByFilter.js`

The script file keeps its original filename for update compatibility, but the
PixInsight menu entry and dialog title are `ImageBatchManager`.

`src/scripts/Toolbox/MatchOpenImageSizes.js`

`src/scripts/Toolbox/ScreenTransferAutoStretch.js`

`src/scripts/Toolbox/ImageDisplayManager.js`

The update package is:

`packages/ChapelAstroUtilities-3.3-beta1.zip`

## Change Log

### Chapel Astro Utilities 3.3-beta1

- DEV beta package.
- Added ImageDisplayManager 1.0.0-beta1.
- Combined Batch Auto Stretch in a distinct upper panel with Match Image Sizes
  in a separate lower panel.
- Kept BatchSTFStretch and MatchOpenImageSizes available as standalone tools.

### Chapel Astro Utilities 3.2-beta2

- DEV beta package.
- Renamed ScreenTransferAutoStretch to BatchSTFStretch 1.0.0-beta2 while
  retaining its installed script filename for update compatibility.
- Updated ImageBatchManager to 3.2-beta1.
- Save-only now keeps source-backed images in their existing source folders and
  asks for a destination folder when selected images were created in PixInsight
  and have no source path.

### Chapel Astro Utilities 3.2-beta1

- DEV beta package.
- Added ScreenTransferAutoStretch 1.0.0-beta1.
- Added selectable batch image handling, Select All/None controls, linked and
  unlinked auto-stretch modes, and ScreenTransferFunction reset.

### Chapel Astro Utilities 3.1

- Live release package.
- Renamed `ImageRenameByFilter` to `ImageBatchManager` in the PixInsight menu,
  dialog title, help text, update feed, and documentation.
- Kept the original script filename for update compatibility so existing
  installations update in place instead of leaving an old duplicate script.

### Chapel Astro Utilities 3.0

- Live release package.
- Updated `ImageRenameByFilter` to 3.0.
- Updated `MatchOpenImageSizes` to 1.0.4.
- Promoted the wizard-based ImageRenameByFilter workflow to live, including
  filter mapping rename, suffix append, single-image rename, and save-only
  overwrite mode.
- Promoted the Chapel Astro Utilities menu location and MatchOpenImageSizes
  companion workflow to live.

### Chapel Astro Utilities 2.6-beta14

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta11.
- Changed save-only overwrite into a normal Step 1 mode.
- The save button now appears on Step 2 after users have selected the images
  to save, and save-only overwrite uses each image source folder rather than a
  remembered output folder.

### Chapel Astro Utilities 2.6-beta13

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta10.
- Moved the save-only `Save && Overwrite Selected` action onto Step 1 so
  selected images can be saved immediately without continuing through the
  wizard.

### Chapel Astro Utilities 2.6-beta12

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta9.
- Moved `Save && Overwrite Selected` to the image selection step so checked
  images can be saved immediately without continuing through the wizard.

### Chapel Astro Utilities 2.6-beta11

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta8.
- Single-image rename now validates the visible preview tick boxes before
  refreshing the preview, so Next refuses more than one selected image instead
  of silently reducing the selection.
- The single-image summary now states that only the one ticked image will be
  renamed.

### Chapel Astro Utilities 2.6-beta10

- DEV beta package.
- Updated `MatchOpenImageSizes` to 1.0.4-beta7.
- Removed the experimental option to open `ImageRenameByFilter` automatically
  after matching. PixInsight does not support recursive script execution from
  this context, so the utilities remain separate menu actions.

### Chapel Astro Utilities 2.6-beta9

- DEV beta package.
- Updated `MatchOpenImageSizes` to 1.0.4-beta6.
- Added local `HorizontalSizer` and `VerticalSizer` helper constructors so the
  resize script remains include-free without losing its dialog layout classes.

### Chapel Astro Utilities 2.6-beta8

- DEV beta package.
- Updated `MatchOpenImageSizes` to 1.0.4-beta5.
- Removed all PJSR `#include` directives from `MatchOpenImageSizes`; the
  script now defines its small set of required constants locally to avoid the
  PixInsight include parser failure seen on some installs.

### Chapel Astro Utilities 2.6-beta7

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta7.
- Updated `MatchOpenImageSizes` to 1.0.4-beta4.
- Replaced script title/version `#define` macros with plain JavaScript
  variables to avoid PixInsight preprocessor expansion errors.

### Chapel Astro Utilities 2.6-beta6

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta6.
- Updated `MatchOpenImageSizes` to 1.0.4-beta3.
- Removed the temporary include guards from `ImageRenameByFilter`; both scripts
  now load as standalone PixInsight scripts again.

### Chapel Astro Utilities 2.6-beta5

- DEV beta package.
- Updated `MatchOpenImageSizes` to 1.0.4-beta2.
- Fixed `MatchOpenImageSizes` load failure by replacing the embedded
  `ImageRenameByFilter` include with PixInsight's `Script` process launcher.

### Chapel Astro Utilities 2.6-beta4

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta4.
- Step 1 now hides the suffix and ad-hoc new-name fields until the matching
  mode is selected, showing only the relevant field for the chosen operation.

### Chapel Astro Utilities 2.6-beta3

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta3.
- Updated `MatchOpenImageSizes` to 1.0.4-beta1.
- Added an optional `Open ImageRenameByFilter after matching` handoff from
  `MatchOpenImageSizes` so the resize/match workflow can move directly into
  the rename wizard.

### Chapel Astro Utilities 2.6-beta2

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta2.
- Moved Rename individual image into Step 1.
- Suffix entry is shown only when Append suffix to current names is selected.
- Single-image rename mode requires exactly one selected image.
- Final summary action is now `Apply Changes` at the bottom right.

### Chapel Astro Utilities 2.6-beta1

- DEV beta package.
- Updated `ImageRenameByFilter` to 2.6-beta1.
- Reworked `ImageRenameByFilter` as a wizard flow:
  resize/operation choice, image selection, window options, save options,
  optional reopen saved images, and final summary/process.

### Chapel Astro Utilities 2.5

- Updated `ImageRenameByFilter` to 2.5.
- Updated `MatchOpenImageSizes` to 1.0.3.
- Added all-rights-reserved copyright notices to the repository and distributed script files.

### Chapel Astro Utilities 2.4

- Updated `ImageRenameByFilter` to 2.4.
- Collapsed source images are now stacked into a neat vertical column after save/collapse operations where PixInsight exposes writable icon geometry.

### Chapel Astro Utilities 2.3

- Updated `ImageRenameByFilter` to 2.3.
- `Save & Overwrite Selected` now respects the folder field while keeping the current open image name as the saved filename.
- If the folder field is blank, the operation still falls back to the image source folder.

### Chapel Astro Utilities 2.2

- Updated `ImageRenameByFilter` to 2.2.
- `Save & Overwrite Selected` now always saves each selected image using its current open image name.
- This prevents a manually renamed image from being saved back to a mapped preview name or an earlier filename.

### Chapel Astro Utilities 2.1

- Updated `ImageRenameByFilter` to 2.1.
- Added a single-image ad-hoc rename section.
- Ad-hoc renames require exactly one selected preview image, reject duplicate open image identifiers, and enforce PixInsight identifier rules.

### Chapel Astro Utilities 2.0

- Updated `ImageRenameByFilter` to 2.0.
- Added a `?` help button with an operational guide for rename modes, mappings, suffixes, save-after-renaming, and in-place overwrite.

### Chapel Astro Utilities 1.0.8

- Updated `ImageRenameByFilter` to 1.0.8.
- Added `Nofilter -> OSC` at the top of the default rename mappings for one-shot colour images.

### Chapel Astro Utilities 1.0.7

- Updated `ImageRenameByFilter` to 1.0.7.
- The output folder now defaults to the source directory used by the majority of currently open images.
- A manually typed or browsed folder is still respected for the current dialog session.

### Chapel Astro Utilities 1.0.6

- Updated `ImageRenameByFilter` to 1.0.6.
- `Save & Overwrite Selected` now saves to the current or previewed image name in the source folder instead of blindly reusing the originally loaded file path.
- This prevents processed `H_PreNoiseX`, `L_PreNoiseX`, and similar windows from overwriting the earlier `H`, `L`, and `R` files.

### Chapel Astro Utilities 1.0.5

- Updated `ImageRenameByFilter` to 1.0.5.
- Rename-only operations now always leave selected images open.
- Added a rename-only note and disabled post-save controls when saving is off.
- Left-aligned the main rename/apply and in-place save action buttons.

### Chapel Astro Utilities 1.0.4

- Updated `ImageRenameByFilter` to 1.0.4.
- Reopened saved-image windows now use tighter fit-to-zoom sizing and attempt
  multiple PixInsight frame sizing methods.
- Decluttered the bottom controls into separate preview selection, rename/apply,
  and in-place save sections.

### Chapel Astro Utilities 1.0.3

- Updated `ImageRenameByFilter` to 1.0.3.
- Removed boolean return values from the reopened-window fit-to-zoom helper to
  avoid PixInsight parser/static-analysis errors.

### Chapel Astro Utilities 1.0.2

- Updated `ImageRenameByFilter` to 1.0.2.
- Simplified the reopened-window fit-to-zoom implementation to avoid a
  PixInsight strict parser error seen in 1.0.1.

### Chapel Astro Utilities 1.0.1

- Updated `ImageRenameByFilter` to 1.0.1.
- Reopened saved images now keep the saved zoom and resize their windows to the
  zoomed image footprint to reduce large gray margins.

### Chapel Astro Utilities 1.0.0

- Added `ImageRenameByFilter` 1.0.0.
- Updated `MatchOpenImageSizes` to 1.0.2.
- Moved scripts to `Script > Chapel Astro Utilities`.
