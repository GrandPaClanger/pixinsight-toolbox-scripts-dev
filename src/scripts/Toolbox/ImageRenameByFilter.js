// ImageBatchManager
// Installed as ImageRenameByFilter.js for update compatibility.
//
// PixInsight JavaScript Runtime script.
//
// Copyright (c) 2026 Ian Steane. All rights reserved.
// Public visibility is for PixInsight update distribution only. No permission
// is granted to copy, modify, redistribute, repackage, sell, sublicense, or
// create derivative works without prior written permission.
//
// Rename open image windows by matching configurable filename/view-id tokens to
// short filter names. Mappings are persisted in PixInsight settings.

#feature-id    ImageBatchManager : Chapel Astro Utilities > ImageBatchManager
#feature-info  Rename open master light images by filter mapping, with optional save-as output.

#include <pjsr/DataType.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/Sizer.jsh>
#include <pjsr/SampleType.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/UndoFlag.jsh>

var IMAGE_RENAME_TITLE = "ImageBatchManager";
var IMAGE_RENAME_VERSION = "3.2-beta2";
var IMAGE_RENAME_SETTINGS_ROOT = "GrandPaClanger/ImageRenameByFilter";

var DEFAULT_MAPPINGS =
   "Nofilter,OSC\n" +
   "Luminance,L\n" +
   "Red,R\n" +
   "Green,G\n" +
   "Blue,B\n" +
   "Sulphur,S\n" +
   "Hydrogen,H\n" +
   "Oxygen,O\n";

function trimString( s )
{
   return s.replace( /^\s+|\s+$/g, "" );
}

function stringOrEmpty( value )
{
   return typeof value == "string" ? value : "";
}

function settingReadString( key, fallback )
{
   try
   {
      var value = Settings.read( IMAGE_RENAME_SETTINGS_ROOT + "/" + key, DataType_String );
      if ( Settings.lastReadOK && typeof value == "string" && value.length > 0 )
         return value;
   }
   catch ( error )
   {
   }

   return fallback;
}

function settingWriteString( key, value )
{
   try
   {
      Settings.write( IMAGE_RENAME_SETTINGS_ROOT + "/" + key, DataType_String, value );
   }
   catch ( error )
   {
      Console.warningln( "Could not save setting '" + key + "': " + error.message );
   }
}

function saveSettings( mappingsText, saveImages, outputDirectory, suffix, postSaveAction, openSavedImages, renameMode )
{
   settingWriteString( "mappings", mappingsText );
   settingWriteString( "saveImages", saveImages ? "true" : "false" );
   settingWriteString( "outputDirectory", outputDirectory );
   settingWriteString( "postSaveAction", postSaveAction );
   settingWriteString( "openSavedImages", openSavedImages ? "true" : "false" );
}

function parseCsvLine( line )
{
   var fields = new Array;
   var field = "";
   var quoted = false;

   for ( var i = 0; i < line.length; ++i )
   {
      var c = line.charAt( i );

      if ( c == '"' )
      {
         if ( quoted && i + 1 < line.length && line.charAt( i + 1 ) == '"' )
         {
            field += '"';
            ++i;
         }
         else
            quoted = !quoted;
      }
      else if ( c == "," && !quoted )
      {
         fields.push( trimString( field ) );
         field = "";
      }
      else
         field += c;
   }

   fields.push( trimString( field ) );
   return fields;
}

function parseMappings( text )
{
   var mappings = new Array;
   var lines = text.replace( /\r\n/g, "\n" ).replace( /\r/g, "\n" ).split( "\n" );

   for ( var i = 0; i < lines.length; ++i )
   {
      var line = trimString( lines[i] );

      if ( line.length == 0 || line.charAt( 0 ) == "#" )
         continue;

      var fields = parseCsvLine( line );
      if ( fields.length < 2 )
         throw new Error( "Mapping line " + (i + 1).toString() +
                          " must be CSV: text to find, new image name." );

      if ( fields[0].length == 0 || fields[1].length == 0 )
         throw new Error( "Mapping line " + (i + 1).toString() +
                          " has an empty match or image name." );

      mappings.push( {
         match: fields[0],
         imageId: fields[1],
         line: i + 1
      } );
   }

   if ( mappings.length == 0 )
      throw new Error( "Add at least one mapping line." );

   return mappings;
}

function mappingsToText( mappings )
{
   var lines = new Array;

   for ( var i = 0; i < mappings.length; ++i )
      lines.push( mappings[i].match + "," + mappings[i].imageId );

   return lines.join( "\n" ) + "\n";
}

function sanitizeViewId( id )
{
   var result = trimString( id ).replace( /[^A-Za-z0-9_]/g, "_" );
   result = result.replace( /_+/g, "_" ).replace( /^_+|_+$/g, "" );

   if ( result.length == 0 )
      result = "Image";

   if ( !/^[A-Za-z_]/.test( result ) )
      result = "_" + result;

   return result;
}

function isValidViewId( id )
{
   return /^[A-Za-z_][A-Za-z0-9_]*$/.test( id );
}

function validViewIdMessage()
{
   return "PixInsight identifiers must start with an alphabetic or underscore character and can only contain alphabetic, decimal digit, or underscore characters.";
}

function setControlBold( control, bold )
{
   try
   {
      var font = control.font;
      font.bold = bold;
      control.font = font;
   }
   catch ( error )
   {
   }
}

function sanitizeOptionalSuffix( suffix )
{
   if ( trimString( suffix ).length == 0 )
      return "";

   return sanitizeViewId( suffix );
}

function suffixViewId( id, suffix )
{
   var cleanSuffix = sanitizeOptionalSuffix( suffix );

   if ( cleanSuffix.length == 0 )
      return sanitizeViewId( id );

   return sanitizeViewId( id + "_" + cleanSuffix );
}

function windowFilePath( window )
{
   try
   {
      if ( typeof window.filePath == "string" )
         return window.filePath;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.currentFilePath == "string" )
         return window.currentFilePath;
   }
   catch ( error2 )
   {
   }

   return "";
}

function windowSearchText( window )
{
   var text = window.mainView.id;
   var filePath = windowFilePath( window );

   if ( filePath.length > 0 )
      text += " " + filePath;

   try
   {
      if ( typeof window.caption == "string" )
         text += " " + window.caption;
   }
   catch ( error )
   {
   }

   return text;
}

function directoryOfPath( filePath )
{
   var slash = Math.max( filePath.lastIndexOf( "/" ), filePath.lastIndexOf( "\\" ) );
   return slash >= 0 ? filePath.substring( 0, slash ) : "";
}

function extensionOfPath( filePath )
{
   var slash = Math.max( filePath.lastIndexOf( "/" ), filePath.lastIndexOf( "\\" ) );
   var dot = filePath.lastIndexOf( "." );

   if ( dot > slash )
      return filePath.substring( dot );

   return ".xisf";
}

function joinPath( directory, fileName )
{
   if ( directory.length == 0 )
      return fileName;

   var last = directory.charAt( directory.length - 1 );
   if ( last == "/" || last == "\\" )
      return directory + fileName;

   return directory + "/" + fileName;
}

function findMapping( window, mappings )
{
   var text = windowSearchText( window ).toLowerCase();
   var best = null;

   for ( var i = 0; i < mappings.length; ++i )
      if ( text.indexOf( mappings[i].match.toLowerCase() ) >= 0 )
         if ( best == null || mappings[i].match.length > best.match.length )
            best = mappings[i];

   return best;
}

function existingViewIds()
{
   var ids = {};
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
      ids[windows[i].mainView.id] = true;

   return ids;
}

function isCollapsedWindow( window )
{
   try
   {
      if ( typeof window.isIconic == "boolean" && window.isIconic )
         return true;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.iconic == "boolean" && window.iconic )
         return true;
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.isVisible == "boolean" && !window.isVisible )
         return true;
   }
   catch ( error3 )
   {
   }

   try
   {
      if ( typeof window.isShaded == "boolean" && window.isShaded )
         return true;
   }
   catch ( error4 )
   {
   }

   return false;
}

function allocateViewId( requestedId, allocated, currentId )
{
   var base = sanitizeViewId( requestedId );
   var candidate = base;
   var suffix = 2;

   while ( allocated[candidate] && candidate != currentId )
   {
      candidate = base + "_" + suffix.toString();
      ++suffix;
   }

   allocated[candidate] = true;
   return candidate;
}

function buildPlan( mappings, suffix, previousSelections, renameMode )
{
   var windows = ImageWindow.windows;
   var allocated = existingViewIds();
   var plan = new Array;

   for ( var i = 0; i < windows.length; ++i )
   {
      var window = windows[i];
      var currentId = window.mainView.id;
      var mapping = findMapping( window, mappings );
      var sourcePath = windowFilePath( window );
      var newId = "";
      var selected = !isCollapsedWindow( window );

      if ( renameMode == "suffixOnly" )
      {
         newId = allocateViewId( suffixViewId( currentId, suffix ), allocated, currentId );
         mapping = {
            match: "current name",
            imageId: currentId,
            line: 0,
            suffixOnly: true
         };
      }
      else if ( renameMode == "saveOnly" )
      {
         newId = currentId;
         mapping = {
            match: "current name",
            imageId: currentId,
            line: 0,
            saveOnly: true
         };
      }
      else if ( mapping != null )
         newId = allocateViewId( suffixViewId( mapping.imageId, suffix ), allocated, currentId );

      if ( previousSelections != null && typeof previousSelections[currentId] == "boolean" )
         selected = previousSelections[currentId];

      plan.push( {
         window: window,
         currentId: currentId,
         sourcePath: sourcePath,
         sourceDirectory: directoryOfPath( sourcePath ),
         extension: extensionOfPath( sourcePath ),
         mapping: mapping,
         newId: newId,
         selected: selected,
         collapsed: isCollapsedWindow( window ),
         savePath: "",
         displayGeometry: null,
         savedWindow: null
      } );
   }

   return plan;
}

function defaultOutputDirectory( plan )
{
   var counts = new Object;
   var directories = new Array;
   var bestDirectory = "";
   var bestCount = 0;

   for ( var i = 0; i < plan.length; ++i )
   {
      var directory = plan[i].sourceDirectory;

      if ( directory.length > 0 )
      {
         if ( counts[directory] == null )
         {
            counts[directory] = 0;
            directories.push( directory );
         }

         ++counts[directory];
      }
   }

   for ( var j = 0; j < directories.length; ++j )
      if ( counts[directories[j]] > bestCount )
      {
         bestDirectory = directories[j];
         bestCount = counts[directories[j]];
      }

   if ( bestDirectory.length > 0 )
      return bestDirectory;

   return settingReadString( "outputDirectory", "" );
}

function previewStatus( item, saveImages, outputDirectory )
{
   if ( !item.selected )
      return item.collapsed ? "Skipped collapsed" : "Skipped";

   if ( item.mapping == null )
      return "No mapping";

   if ( saveImages && outputDirectory.length == 0 && item.sourceDirectory.length == 0 )
      return "Needs output folder";

   if ( item.newId != item.mapping.imageId )
      return "Will rename uniquely";

   return "Ready";
}

function fillPreview( treeBox, plan, saveImages, outputDirectory )
{
   treeBox.clear();

   for ( var i = 0; i < plan.length; ++i )
   {
      var item = plan[i];
      var node = new TreeBoxNode( treeBox );

      node.__planIndex = i;
      node.checkable = true;
      node.checked = item.selected;
      node.setText( 0, item.currentId );
      node.setText( 1, item.mapping != null ? item.mapping.match : "" );
      node.setText( 2, item.newId );
      node.setText( 3, previewStatus( item, saveImages, outputDirectory ) );
   }

   try
   {
      treeBox.setColumnWidth( 0, 245 );
      treeBox.setColumnWidth( 1, 170 );
      treeBox.setColumnWidth( 2, 220 );
      treeBox.setColumnWidth( 3, 110 );
   }
   catch ( error )
   {
   }
}

function setPreviewSelections( treeBox, plan, selected )
{
   try
   {
      for ( var i = 0; i < treeBox.numberOfChildren; ++i )
      {
         var node = treeBox.child( i );
         if ( node != null && typeof node.__planIndex == "number" )
         {
            node.checked = selected;
            plan[node.__planIndex].selected = selected;
         }
      }
   }
   catch ( error )
   {
   }
}

function capturePreviewSelections( treeBox, plan )
{
   var selections = {};

   for ( var i = 0; i < plan.length; ++i )
      selections[plan[i].currentId] = plan[i].selected;

   try
   {
      for ( var j = 0; j < treeBox.numberOfChildren; ++j )
      {
         var node = treeBox.child( j );
         if ( node != null && typeof node.__planIndex == "number" )
            selections[plan[node.__planIndex].currentId] = node.checked;
      }
   }
   catch ( error )
   {
   }

   return selections;
}

function syncPreviewSelections( treeBox, plan )
{
   try
   {
      for ( var i = 0; i < treeBox.numberOfChildren; ++i )
      {
         var node = treeBox.child( i );
         if ( node != null && typeof node.__planIndex == "number" )
            plan[node.__planIndex].selected = node.checked;
      }
   }
   catch ( error )
   {
   }
}

function countPreviewSelections( treeBox, plan )
{
   var n = 0;

   try
   {
      for ( var i = 0; i < treeBox.numberOfChildren; ++i )
      {
         var node = treeBox.child( i );
         if ( node != null && typeof node.__planIndex == "number" && node.checked )
            ++n;
      }

      return n;
   }
   catch ( error )
   {
   }

   return countSelected( plan );
}

function enforceSinglePreviewSelection( treeBox, plan )
{
   var found = false;

   try
   {
      for ( var i = 0; i < treeBox.numberOfChildren; ++i )
      {
         var node = treeBox.child( i );

         if ( node != null && typeof node.__planIndex == "number" )
         {
            if ( node.checked && !found )
            {
               found = true;
               plan[node.__planIndex].selected = true;
            }
            else
            {
               node.checked = false;
               plan[node.__planIndex].selected = false;
            }
         }
      }
   }
   catch ( error )
   {
   }
}

function countMatched( plan )
{
   var n = 0;

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected && plan[i].mapping != null )
         ++n;

   return n;
}

function countSelected( plan )
{
   var n = 0;

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected )
         ++n;

   return n;
}

function showHelpDialog()
{
   var helpText =
      "IMAGE BATCH MANAGER " + IMAGE_RENAME_VERSION + "\n\n" +
      "[1] RENAME MODES\n" +
      "- Rename By Filter Mappings: matches text in the image id, filename, or caption and renames to the mapped value.\n" +
      "- Append suffix to current names: adds the suffix to the current image id. Filter matching is ignored.\n" +
      "- Rename individual image: enter an ad-hoc name in Step 1, select exactly one image in Step 2, then use Apply Changes in the summary.\n" +
      "- Save selected images only: select images in Step 2, then save and overwrite them without renaming.\n" +
      "- Select a mode before using Apply Changes.\n\n" +
      "[2] SINGLE IMAGE RENAME\n" +
      "- Tick exactly one image in the Preview list.\n" +
      "- Enter an ad-hoc name in Step 1 and select exactly one image in Step 2.\n" +
      "- The name must be a valid PixInsight identifier and must not duplicate another open image id.\n" +
      "- This updates the side tab and top caption only. It does not save files.\n\n" +
      "[3] MAPPINGS\n" +
      "- Text to find is the token to search for, such as Red, Hydrogen, or Nofilter.\n" +
      "- Rename to is the new PixInsight image identifier, such as R, H, or OSC.\n" +
      "- Use Default Mappings to restore the supplied defaults. Custom mappings are remembered.\n\n" +
      "[4] SUFFIXES\n" +
      "- Suffix text is sanitised for PixInsight identifiers.\n" +
      "- PreNoiseX becomes _PreNoiseX, for example R_PreNoiseX.\n" +
      "- Rename-only operations do not save, close, or collapse images.\n\n" +
      "[5] SAVE AFTER RENAMING\n" +
      "- When enabled, Apply Changes also saves renamed files to the selected folder.\n" +
      "- The folder defaults to the source directory used by most open images.\n" +
      "- After save can leave, collapse, or close the selected source images.\n" +
      "- Collapsed source images are stacked into a neat column when PixInsight exposes writable icon geometry.\n" +
      "- Open newly saved images reloads the saved files after the save operation.\n\n" +
      "[6] SAVE & OVERWRITE SELECTED\n" +
      "- Choose Save selected images only on Step 1, then tick images on Step 2.\n" +
      "- It saves selected open images to their current image names in their source folders.\n" +
      "- If selected images were created in PixInsight and have no source folder, choose one destination folder for those new images.\n" +
      "- It overwrites after one confirmation, so check the Preview New column first.";

   (new MessageBox( helpText, IMAGE_RENAME_TITLE + " Help", StdIcon_Information,
                    StdButton_Ok )).execute();
}

function outputSavePath( item, outputDirectory )
{
   var directory = outputDirectory.length > 0 ? outputDirectory : item.sourceDirectory;
   return joinPath( directory, item.newId + item.extension );
}

function overwriteTargetId( item )
{
   return item.currentId;
}

function overwriteTargetPath( item, outputDirectory )
{
   var directory = item.sourceDirectory.length > 0 ?
      item.sourceDirectory :
      outputDirectory;
   var extension = item.extension.length > 0 ? item.extension : ".xisf";

   if ( directory.length == 0 )
      return "";

   return joinPath( directory, overwriteTargetId( item ) + extension );
}

function overwriteSelectedCurrentFiles( plan, outputDirectory )
{
   var selected = 0;
   var sourceLess = new Array;

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected )
      {
         ++selected;

         if ( plan[i].sourceDirectory.length == 0 )
            sourceLess.push( plan[i].currentId );
      }

   if ( selected == 0 )
   {
      (new MessageBox( "Select at least one image in the preview before saving.",
                       IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
      return;
   }

   if ( sourceLess.length > 0 && outputDirectory.length == 0 )
   {
      var directoryDialog = new GetDirectoryDialog;
      directoryDialog.caption =
         "Select a folder for newly created images";
      directoryDialog.initialPath =
         settingReadString( "outputDirectory", "" );

      if ( !directoryDialog.execute() )
         return;

      outputDirectory = directoryDialog.directory;
      settingWriteString( "outputDirectory", outputDirectory );
   }

   var message = sourceLess.length > 0 ?
      "Save " + selected.toString() + " selected image(s)?\n\n" +
      "Images with source files will be overwritten in their existing source folders.\n\n" +
      "Newly created images will be saved to:\n" + outputDirectory :
      "Overwrite the existing files for " + selected.toString() +
      " selected image(s)?\n\n" +
      "Each selected image will be saved to its current image name in its source folder.";

   if ( (new MessageBox( message, IMAGE_RENAME_TITLE, StdIcon_Warning,
                         StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
      return;

   Console.show();
   Console.writeln( "<end><cbr><br>" + IMAGE_RENAME_TITLE + " " + IMAGE_RENAME_VERSION );
   Console.writeln( "Saving and overwriting selected image files." );

   for ( var j = 0; j < plan.length; ++j )
      if ( plan[j].selected )
      {
         var targetId = overwriteTargetId( plan[j] );
         var targetPath = overwriteTargetPath( plan[j], outputDirectory );
         var originalId = plan[j].window.mainView.id;

         if ( originalId != targetId )
         {
            plan[j].window.mainView.id = targetId;
            cleanCaption( plan[j].window, targetId );
         }

         removeFileIfExists( targetPath );
         saveWindowAs( plan[j].window, targetPath );
         Console.writeln( "Overwrote " + targetPath );
      }

   Console.writeln( "Done. Overwrote " + selected.toString() + " selected image file(s)." );
}

function renameSingleSelectedImage( plan, requestedId )
{
   var selected = new Array;
   var newId = trimString( requestedId );

   for ( var i = 0; i < plan.length; ++i )
      if ( plan[i].selected )
         selected.push( plan[i] );

   if ( selected.length == 0 )
      throw new Error( "Select one image in the preview before using the ad-hoc rename." );

   if ( selected.length > 1 )
      throw new Error( "Select only one image in the preview before using the ad-hoc rename." );

   if ( newId.length == 0 )
      throw new Error( "Enter a new image name." );

   if ( !isValidViewId( newId ) )
      throw new Error( "Invalid PixInsight identifier: " + newId + "\n\n" +
                       validViewIdMessage() );

   var item = selected[0];
   var existing = existingViewIds();

   if ( existing[newId] && newId != item.currentId )
      throw new Error( "Another open image already uses the identifier '" + newId + "'." );

   if ( newId == item.currentId )
      throw new Error( "The selected image already uses the identifier '" + newId + "'." );

   item.window.mainView.id = newId;
   cleanCaption( item.window, newId );

   Console.show();
   Console.writeln( "<end><cbr><br>" + IMAGE_RENAME_TITLE + " " + IMAGE_RENAME_VERSION );
   Console.writeln( "Renamed " + item.currentId + " -> " + newId + "." );
}

function confirmOverwrites( plan, outputDirectory )
{
   var overwriteCount = 0;

   for ( var i = 0; i < plan.length; ++i )
   {
      var item = plan[i];
      if ( item.selected && item.mapping != null )
      {
         var directory = outputDirectory.length > 0 ? outputDirectory : item.sourceDirectory;
         if ( directory.length > 0 && savePathExists( outputSavePath( item, outputDirectory ) ) )
            ++overwriteCount;
      }
   }

   if ( overwriteCount == 0 )
      return true;

   var overwriteMessage =
      overwriteCount.toString() + " output file(s) already exist.\n\n" +
      "Overwrite existing files for this batch?";

   return (new MessageBox( overwriteMessage, IMAGE_RENAME_TITLE, StdIcon_Warning,
                           StdButton_Yes, StdButton_No )).execute() == StdButton_Yes;
}

function savePathExists( path )
{
   try
   {
      if ( typeof File != "undefined" && typeof File.exists == "function" )
         return File.exists( path );
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof File != "undefined" && typeof File.fileExists == "function" )
         return File.fileExists( path );
   }
   catch ( error2 )
   {
   }

   return false;
}

function removeFileIfExists( path )
{
   if ( !savePathExists( path ) )
      return;

   try
   {
      if ( typeof File != "undefined" && typeof File.remove == "function" )
      {
         File.remove( path );
         return;
      }
   }
   catch ( error1 )
   {
      throw new Error( "Could not remove existing output file:\n" +
                       path + "\n\n" + error1.message );
   }

   throw new Error( "Cannot overwrite existing output file because this PixInsight build did not expose File.remove():\n" + path );
}

function saveWindowAs( window, path )
{
   window.saveAs( path, false, false, true, false );
}

function copyFITSKeywords( sourceWindow, targetWindow )
{
   try
   {
      if ( typeof sourceWindow.keywords == "undefined" ||
           typeof targetWindow.keywords == "undefined" )
         return;

      var sourceKeywords = sourceWindow.keywords;
      var targetKeywords = new Array;

      for ( var i = 0; i < sourceKeywords.length; ++i )
      {
         var keyword = sourceKeywords[i];
         targetKeywords.push( new FITSKeyword( keyword.name,
                                               keyword.value,
                                               keyword.comment ) );
      }

      targetWindow.keywords = targetKeywords;
   }
   catch ( error )
   {
      Console.warningln( "Could not copy FITS header keywords to the temporary save copy: " +
                         error.message );
   }
}

function duplicateWindow( window, id )
{
   try
   {
      var sourceImage = window.mainView.image;
      var isReal = typeof sourceImage.isReal == "boolean" ?
         sourceImage.isReal :
         (typeof sourceImage.sampleType != "undefined" ? sourceImage.sampleType == SampleType_Real : true);
      var isColor = typeof sourceImage.isColor == "boolean" ?
         sourceImage.isColor :
         sourceImage.numberOfChannels > 1;
      var bitsPerSample = typeof sourceImage.bitsPerSample == "number" ?
         sourceImage.bitsPerSample :
         32;
      var copy = new ImageWindow( sourceImage.width,
                                  sourceImage.height,
                                  sourceImage.numberOfChannels,
                                  bitsPerSample,
                                  isReal,
                                  isColor,
                                  id );
      copy.mainView.beginProcess( UndoFlag_NoSwapFile );
      copy.mainView.image.assign( sourceImage );
      copy.mainView.endProcess();
      copyFITSKeywords( window, copy );
      copy.mainView.id = id;
      cleanCaption( copy, id );
      return copy;
   }
   catch ( error )
   {
      throw new Error( "Could not create a temporary copy of " +
                       window.mainView.id + " for saving:\n\n" +
                       error.message );
   }
}

function cleanCaption( window, id )
{
   try
   {
      if ( typeof window.caption == "string" )
         window.caption = id;
   }
   catch ( error )
   {
   }
}

function captureDisplayGeometry( window )
{
   var geometry = {
      hasSize: false,
      width: 0,
      height: 0,
      hasFrameRect: false,
      frameWidth: 0,
      frameHeight: 0,
      zoom: 0
   };

   try
   {
      geometry.zoom = window.zoomFactor;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.width == "number" && typeof window.height == "number" )
      {
         geometry.hasSize = true;
         geometry.width = window.width;
         geometry.height = window.height;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.frameRect != "undefined" )
      {
         geometry.hasFrameRect = true;
         geometry.frameWidth = window.frameRect.width;
         geometry.frameHeight = window.frameRect.height;
      }
   }
   catch ( error3 )
   {
      geometry.hasFrameRect = false;
   }

   return geometry;
}

function showWindow( window )
{
   try
   {
      if ( typeof window.show == "function" )
      {
         window.show();
         return;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.Show == "function" )
         window.Show();
   }
   catch ( error2 )
   {
   }
}

function bringWindowToFront( window )
{
   try
   {
      if ( typeof window.bringToFront == "function" )
      {
         window.bringToFront();
         return;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.BringToFront == "function" )
         window.BringToFront();
   }
   catch ( error2 )
   {
   }
}

function applyDisplayGeometry( window, geometry )
{
   if ( geometry == null )
      return;

   try
   {
      if ( geometry.hasSize && typeof window.resize == "function" )
         window.resize( geometry.width, geometry.height );
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( geometry.hasFrameRect &&
           typeof window.frameRect != "undefined" &&
           typeof window.position != "undefined" )
      {
         var p = window.position;
         window.frameRect = new Rect( p.x,
                                      p.y,
                                      p.x + geometry.frameWidth,
                                      p.y + geometry.frameHeight );
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      window.zoomFactor = geometry.zoom;
   }
   catch ( error3 )
   {
   }
}

function zoomedImageDisplaySize( image, zoom )
{
   var width = image.width;
   var height = image.height;

   if ( zoom > 0 )
   {
      width *= zoom;
      height *= zoom;
   }
   else if ( zoom < 0 )
   {
      width /= -zoom;
      height /= -zoom;
   }

   return {
      width: Math.max( 1, Math.round( width ) ),
      height: Math.max( 1, Math.round( height ) )
   };
}

function fitWindowToCurrentZoom( window )
{
   var image = window.mainView.image;
   var display = zoomedImageDisplaySize( image, window.zoomFactor );

   var targetWidth = Math.max( 120, display.width + 42 );
   var targetHeight = Math.max( 96, display.height + 36 );

   try
   {
      if ( typeof window.resize == "function" )
      {
         window.resize( targetWidth, targetHeight );
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.width == "number" &&
           typeof window.height == "number" )
      {
         window.width = targetWidth;
         window.height = targetHeight;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.frameRect != "undefined" &&
           typeof window.position != "undefined" )
      {
         var p = window.position;
         window.frameRect = new Rect( p.x,
                                      p.y,
                                      p.x + targetWidth,
                                      p.y + targetHeight );
      }
   }
   catch ( error3 )
   {
   }
}

function ensureDirectory( directory )
{
   if ( directory.length == 0 )
      return;

   try
   {
      if ( typeof File != "undefined" &&
           typeof File.directoryExists == "function" &&
           typeof File.createDirectory == "function" &&
           !File.directoryExists( directory ) )
         File.createDirectory( directory, true );
   }
   catch ( error )
   {
      throw new Error( "Could not create output folder:\n" + directory + "\n\n" +
                       error.message );
   }
}

function collapseWindow( window )
{
   try
   {
      if ( typeof window.iconize == "function" )
      {
         window.iconize();
         return true;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.Iconize == "function" )
      {
         window.Iconize();
         return true;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.hide == "function" )
      {
         window.hide();
         return true;
      }
   }
   catch ( error3 )
   {
   }

   try
   {
      if ( typeof window.Hide == "function" )
      {
         window.Hide();
         return true;
      }
   }
   catch ( error4 )
   {
   }

   return false;
}

function moveWindowTo( window, x, y )
{
   try
   {
      if ( typeof window.moveTo == "function" )
      {
         window.moveTo( x, y );
         return true;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.position != "undefined" )
      {
         window.position = new Point( x, y );
         return true;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.frameRect != "undefined" )
      {
         var r = window.frameRect;
         window.frameRect = new Rect( x, y, x + r.width, y + r.height );
         return true;
      }
   }
   catch ( error3 )
   {
   }

   return false;
}

function stackCollapsedWindows( windows )
{
   var x = 12;
   var y = 36;
   var spacing = 28;
   var moved = 0;

   for ( var i = 0; i < windows.length; ++i )
      if ( moveWindowTo( windows[i], x, y + i * spacing ) )
         ++moved;

   return moved;
}

function closeWindow( window )
{
   try
   {
      if ( typeof window.forceClose == "function" )
      {
         window.forceClose();
         return true;
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.ForceClose == "function" )
      {
         window.ForceClose();
         return true;
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( typeof window.close == "function" )
         return window.close();
   }
   catch ( error3 )
   {
   }

   try
   {
      if ( typeof window.Close == "function" )
         return window.Close();
   }
   catch ( error4 )
   {
   }

   return false;
}

function openImageWindows( path, id )
{
   try
   {
      if ( typeof ImageWindow.open == "function" )
         return ImageWindow.open( path );
   }
   catch ( error1 )
   {
      Console.warningln( "ImageWindow.open failed for " + path + ": " + error1.message );
   }

   try
   {
      if ( typeof ImageWindow.Open == "function" )
         return ImageWindow.Open( path );
   }
   catch ( error2 )
   {
      Console.warningln( "ImageWindow.Open failed for " + path + ": " + error2.message );
   }

   try
   {
      if ( typeof ImageWindow.open == "function" )
         return ImageWindow.open( path, id );
   }
   catch ( error3 )
   {
      Console.warningln( "ImageWindow.open(path,id) failed for " + path + ": " + error3.message );
   }

   try
   {
      if ( typeof ImageWindow.Open == "function" )
         return ImageWindow.Open( path, id );
   }
   catch ( error4 )
   {
      Console.warningln( "ImageWindow.Open(path,id) failed for " + path + ": " + error4.message );
   }

   return new Array;
}

function openedWindowAt( opened, index )
{
   try
   {
      if ( opened == null )
         return null;

      var item = typeof opened.length == "number" ? opened[index] : opened;

      if ( item == null )
         return null;

      if ( typeof item.isNull == "boolean" && item.isNull )
         return null;

      if ( typeof item.mainView != "undefined" )
         return item;

      if ( typeof item.window != "undefined" )
         return item.window;
   }
   catch ( error )
   {
   }

   return null;
}

function openedWindowCount( opened )
{
   try
   {
      if ( opened == null )
         return 0;

      if ( typeof opened.length == "number" )
         return opened.length;

      return 1;
   }
   catch ( error )
   {
   }

   return 0;
}

function hasUsableMainView( window )
{
   try
   {
      if ( window == null )
         return false;

      if ( typeof window.isNull == "boolean" && window.isNull )
         return false;

      if ( typeof window.mainView == "undefined" )
         return false;

      if ( typeof window.mainView.isNull == "boolean" && window.mainView.isNull )
         return false;

      return true;
   }
   catch ( error )
   {
   }

   return false;
}

function openSavedImage( path, id, geometry )
{
   try
   {
      var allocated = existingViewIds();
      var openId = allocateViewId( id, allocated, "" );
      var opened = openImageWindows( path, openId );
      var count = openedWindowCount( opened );
      var openedCount = 0;

      for ( var i = 0; i < count; ++i )
      {
         var window = openedWindowAt( opened, i );

         if ( !hasUsableMainView( window ) )
         {
            Console.warningln( "Skipped a null image window returned while opening " + path + "." );
            continue;
         }

         var openedId = openedCount == 0 ? openId : allocateViewId( id, allocated, "" );

         try
         {
            window.mainView.id = openedId;
         }
         catch ( idError )
         {
            Console.warningln( "Could not set opened image id to " +
                               openedId + ": " + idError.message );
         }

         cleanCaption( window, openedId );
         showWindow( window );
         applyDisplayGeometry( window, geometry );
         fitWindowToCurrentZoom( window );
         bringWindowToFront( window );
         ++openedCount;
      }

      return openedCount;
   }
   catch ( error )
   {
      Console.warningln( "Could not open saved image " + path + ": " + error.message );
   }

   return 0;
}

function applyPlan( plan, saveImages, outputDirectory, postSaveAction, openSavedImages )
{
   var renamed = 0;
   var saved = 0;
   var opened = 0;
   var postActions = new Array;
   var collapsedWindows = new Array;

   Console.show();
   Console.writeln( "<end><cbr><br>" + IMAGE_RENAME_TITLE + " " + IMAGE_RENAME_VERSION );

   for ( var i = 0; i < plan.length; ++i )
   {
      var item = plan[i];

      if ( !item.selected )
      {
         Console.writeln( "Skipped " + item.currentId + "." );
         continue;
      }

      if ( item.mapping == null )
      {
         Console.warningln( "No mapping for " + item.currentId + "." );
         continue;
      }

      var copyOnly = saveImages && item.mapping != null && item.mapping.suffixOnly;

      if ( !copyOnly )
      {
         item.window.mainView.id = item.newId;
         cleanCaption( item.window, item.newId );
         ++renamed;
         Console.writeln( "Renamed " + item.currentId + " -> " + item.newId + "." );
      }
      else
      {
         Console.writeln( "Saving " + item.currentId + " as " + item.newId +
                          " without renaming the open source image." );
      }

      if ( saveImages )
      {
         var directory = outputDirectory.length > 0 ? outputDirectory : item.sourceDirectory;

         if ( directory.length == 0 )
            throw new Error( "No output directory is available for " + item.newId + "." );

         ensureDirectory( directory );

         var savePath = outputSavePath( item, outputDirectory );
         item.savePath = savePath;
         var saveWindow = item.window;

         if ( copyOnly )
            saveWindow = duplicateWindow( item.window, item.newId );

         saveWindowAs( saveWindow, savePath );
         if ( copyOnly )
         {
            item.displayGeometry = captureDisplayGeometry( item.window );
            item.savedWindow = saveWindow;
         }
         else
         {
            item.window.mainView.id = item.newId;
            cleanCaption( item.window, item.newId );
            item.displayGeometry = captureDisplayGeometry( item.window );
         }
         ++saved;
         Console.writeln( "Saved " + savePath );

         if ( openSavedImages )
         {
            if ( postSaveAction != "close" )
            {
               item.window.mainView.id = item.currentId;
               cleanCaption( item.window, item.currentId );
            }

            postActions.push( item );
         }
         else if ( copyOnly )
            closeWindow( saveWindow );
      }
   }

   if ( saveImages )
   {
      for ( var j = 0; j < postActions.length; ++j )
      {
         var actionItem = postActions[j];

         if ( postSaveAction == "close" )
            closeWindow( actionItem.window );
         else if ( postSaveAction == "collapse" )
         {
            if ( collapseWindow( actionItem.window ) )
               collapsedWindows.push( actionItem.window );
         }

         if ( actionItem.savedWindow != null )
         {
            showWindow( actionItem.savedWindow );
            applyDisplayGeometry( actionItem.savedWindow, actionItem.displayGeometry );
            fitWindowToCurrentZoom( actionItem.savedWindow );
            bringWindowToFront( actionItem.savedWindow );
            ++opened;
         }
         else
            opened += openSavedImage( actionItem.savePath,
                                      actionItem.newId,
                                      actionItem.displayGeometry );
      }

      if ( !openSavedImages )
         for ( var k = 0; k < plan.length; ++k )
            if ( plan[k].selected && plan[k].mapping != null )
            {
               if ( postSaveAction == "close" )
                  closeWindow( plan[k].window );
               else if ( postSaveAction == "collapse" )
               {
                  if ( collapseWindow( plan[k].window ) )
                     collapsedWindows.push( plan[k].window );
               }
            }

      if ( collapsedWindows.length > 0 )
      {
         var stacked = stackCollapsedWindows( collapsedWindows );
         if ( stacked > 0 )
            Console.writeln( "Stacked " + stacked.toString() + " collapsed image window(s)." );
      }
   }
   Console.writeln( "Done. Renamed " + renamed.toString() +
                    " image window(s); saved " + saved.toString() +
                    "; opened " + opened.toString() + "." );
}

function exportImageRenameParameters( mappingsText, saveImages, outputDirectory, suffix, postSaveAction, openSavedImages, renameMode )
{
   Parameters.set( "version", IMAGE_RENAME_VERSION );
   Parameters.set( "mappings", mappingsText );
   Parameters.set( "saveImages", saveImages ? "true" : "false" );
   Parameters.set( "outputDirectory", outputDirectory );
   Parameters.set( "suffix", suffix );
   Parameters.set( "postSaveAction", postSaveAction );
   Parameters.set( "openSavedImages", openSavedImages ? "true" : "false" );
   Parameters.set( "renameMode", renameMode );
}

function parametersMappingsText()
{
   if ( Parameters.has( "mappings" ) )
      return Parameters.get( "mappings" );

   return settingReadString( "mappings", DEFAULT_MAPPINGS );
}

function parametersSaveImages()
{
   if ( Parameters.has( "saveImages" ) )
      return Parameters.get( "saveImages" ) == "true";

   return settingReadString( "saveImages", "false" ) == "true";
}

function parametersOutputDirectory()
{
   if ( Parameters.has( "outputDirectory" ) )
      return Parameters.get( "outputDirectory" );

   return settingReadString( "outputDirectory", "" );
}

function parametersSuffix()
{
   if ( Parameters.has( "suffix" ) )
      return Parameters.get( "suffix" );

   return "";
}

function parametersPostSaveAction()
{
   if ( Parameters.has( "postSaveAction" ) )
      return Parameters.get( "postSaveAction" );

   return settingReadString( "postSaveAction", "leave" );
}

function parametersOpenSavedImages()
{
   if ( Parameters.has( "openSavedImages" ) )
      return Parameters.get( "openSavedImages" ) == "true";

   return settingReadString( "openSavedImages", "false" ) == "true";
}

function parametersRenameMode()
{
   if ( Parameters.has( "renameMode" ) )
      return Parameters.get( "renameMode" );

   return "";
}

function ImageRenameByFilterDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var dialog = this;
   var currentPlan = new Array;
   var mappingRows = parseMappings( parametersMappingsText() );
   var selectedMappingIndex = -1;
   var suffixText = parametersSuffix();
   var renameMode = parametersRenameMode();
   var updatingOutputDirectory = false;
   var outputDirectoryManuallyChanged = false;
   var wizardStep = 0;
   var wizardPages = new Array;

   this.windowTitle = IMAGE_RENAME_TITLE + " " + IMAGE_RENAME_VERSION;

   this.infoLabel = new Label( this );
   this.infoLabel.text =
      "Rename open image windows by matching text in the view id, filename, or window caption.";
   this.infoLabel.wordWrapping = true;
   this.infoLabel.frameStyle = FrameStyle_Box;
   this.infoLabel.margin = 6;

   this.wizardStepLabel = new Label( this );
   this.wizardStepLabel.frameStyle = FrameStyle_Box;
   this.wizardStepLabel.margin = 6;
   this.wizardStepLabel.wordWrapping = true;

   this.wizardInstructionLabel = new Label( this );
   this.wizardInstructionLabel.wordWrapping = true;

   this.mappingLabel = new Label( this );
   this.mappingLabel.text = "Rename mappings";

   this.mappingTree = new TreeBox( this );
   this.mappingTree.numberOfColumns = 2;
   this.mappingTree.headerVisible = true;
   this.mappingTree.setHeaderText( 0, "Text to find" );
   this.mappingTree.setHeaderText( 1, "Rename to" );
   this.mappingTree.rootDecoration = false;
   this.mappingTree.alternateRowColor = true;
   this.mappingTree.minHeight = 130;

   this.matchLabel = new Label( this );
   this.matchLabel.text = "Find:";
   this.matchLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.matchEdit = new Edit( this );

   this.nameLabel = new Label( this );
   this.nameLabel.text = "Rename to:";
   this.nameLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.nameEdit = new Edit( this );

   this.addMappingButton = new PushButton( this );
   this.addMappingButton.text = "Add";

   this.updateMappingButton = new PushButton( this );
   this.updateMappingButton.text = "Update";

   this.deleteMappingButton = new PushButton( this );
   this.deleteMappingButton.text = "Delete";

   this.mappingEditSizer = new HorizontalSizer;
   this.mappingEditSizer.spacing = 6;
   this.mappingEditSizer.add( this.matchLabel );
   this.mappingEditSizer.add( this.matchEdit, 100 );
   this.mappingEditSizer.add( this.nameLabel );
   this.mappingEditSizer.add( this.nameEdit, 100 );
   this.mappingEditSizer.add( this.updateMappingButton );
   this.mappingEditSizer.add( this.addMappingButton );
   this.mappingEditSizer.add( this.deleteMappingButton );

   this.mappingSizer = new VerticalSizer;
   this.mappingSizer.spacing = 4;
   this.mappingSizer.add( this.mappingLabel );
   this.mappingSizer.add( this.mappingTree, 100 );
   this.mappingSizer.add( this.mappingEditSizer );

   this.optionsHeaderLabel = new Label( this );
   this.optionsHeaderLabel.text = "Rename / Save Options";
   this.optionsHeaderLabel.frameStyle = FrameStyle_Box;
   this.optionsHeaderLabel.margin = 6;

   this.modeLabel = new Label( this );
   this.modeLabel.text = "Mode:";
   this.modeLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.mappingModeRadio = new RadioButton( this );
   this.mappingModeRadio.text = "Rename By Filter Mappings";
   this.mappingModeRadio.checked = renameMode == "mapping";

   this.suffixOnlyModeRadio = new RadioButton( this );
   this.suffixOnlyModeRadio.text = "Append suffix to current names";
   this.suffixOnlyModeRadio.checked = renameMode == "suffixOnly";

   this.singleRenameModeRadio = new RadioButton( this );
   this.singleRenameModeRadio.text = "Rename individual image";
   this.singleRenameModeRadio.checked = renameMode == "single";

   this.saveOnlyModeRadio = new RadioButton( this );
   this.saveOnlyModeRadio.text = "Save selected images only";
   this.saveOnlyModeRadio.checked = renameMode == "saveOnly";

   this.modePromptLabel = new Label( this );
   this.modePromptLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.modeSizer = new HorizontalSizer;
   this.modeSizer.spacing = 6;
   this.modeSizer.add( this.modeLabel );
   this.modeSizer.add( this.mappingModeRadio );
   this.modeSizer.add( this.suffixOnlyModeRadio );
   this.modeSizer.add( this.singleRenameModeRadio );
   this.modeSizer.add( this.saveOnlyModeRadio );
   this.modeSizer.add( this.modePromptLabel );
   this.modeSizer.addStretch();

   this.suffixLabel = new Label( this );
   this.suffixLabel.text = "Suffix:";
   this.suffixLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.suffixEdit = new Edit( this );
   this.suffixEdit.text = sanitizeOptionalSuffix( suffixText );
   this.suffixEdit.toolTip = "Optional suffix added after the mapped name. Invalid PixInsight identifier characters are converted to underscores.";

   this.suffixPreviewLabel = new Label( this );
   this.suffixPreviewLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.suffixSizer = new HorizontalSizer;
   this.suffixSizer.spacing = 6;
   this.suffixSizer.add( this.suffixLabel );
   this.suffixSizer.add( this.suffixEdit, 100 );
   this.suffixSizer.add( this.suffixPreviewLabel );

   this.saveCheckBox = new CheckBox( this );
   this.saveCheckBox.text = "Save images after renaming";
   this.saveCheckBox.checked = parametersSaveImages();

   this.outputLabel = new Label( this );
   this.outputLabel.text = "Folder:";
   this.outputLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.outputEdit = new Edit( this );
   this.outputEdit.text = parametersOutputDirectory();

   this.browseButton = new ToolButton( this );
   this.browseButton.icon = this.scaledResource( ":/icons/select-file.png" );
   this.browseButton.setScaledFixedSize( 24, 24 );
   this.browseButton.toolTip = "Browse for an output folder.";
   this.browseButton.onClick = function()
   {
      var d = new GetDirectoryDialog;
      d.caption = "Select output folder";
      d.initialPath = dialog.outputEdit.text;

      if ( d.execute() )
      {
         outputDirectoryManuallyChanged = true;
         dialog.outputEdit.text = d.directory;
         dialog.refreshPreview();
      }
   };

   this.folderSizer = new HorizontalSizer;
   this.folderSizer.spacing = 6;
   this.folderSizer.add( this.outputLabel );
   this.folderSizer.add( this.outputEdit, 100 );
   this.folderSizer.add( this.browseButton );

   this.postSaveLabel = new Label( this );
   this.postSaveLabel.text = "After save:";
   this.postSaveLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.postSaveCombo = new ComboBox( this );
   this.postSaveCombo.addItem( "Leave selected images open" );
   this.postSaveCombo.addItem( "Collapse selected images" );
   this.postSaveCombo.addItem( "Close selected images" );

   var postSaveAction = parametersPostSaveAction();
   if ( postSaveAction == "collapse" )
      this.postSaveCombo.currentItem = 1;
   else if ( postSaveAction == "close" )
      this.postSaveCombo.currentItem = 2;
   else
      this.postSaveCombo.currentItem = 0;

   this.openSavedCheckBox = new CheckBox( this );
   this.openSavedCheckBox.text = "Open newly saved images";
   this.openSavedCheckBox.checked = parametersOpenSavedImages();

   this.postSaveSizer = new HorizontalSizer;
   this.postSaveSizer.spacing = 6;
   this.postSaveSizer.add( this.postSaveLabel );
   this.postSaveSizer.add( this.postSaveCombo, 100 );

   this.renameOnlyNoteLabel = new Label( this );
   this.renameOnlyNoteLabel.text =
      "Rename-only operations will not save, close, or collapse images.";
   this.renameOnlyNoteLabel.wordWrapping = true;
   this.renameOnlyNoteLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.windowOptionsNoteLabel = new Label( this );
   this.windowOptionsNoteLabel.text =
      "These window options are applied only when images are saved. Rename-only operations leave source images open.";
   this.windowOptionsNoteLabel.wordWrapping = true;
   this.windowOptionsNoteLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.previewTree = new TreeBox( this );
   this.previewTree.numberOfColumns = 4;
   this.previewTree.headerVisible = true;
   this.previewTree.setHeaderText( 0, "Current" );
   this.previewTree.setHeaderText( 1, "Match" );
   this.previewTree.setHeaderText( 2, "New" );
   this.previewTree.setHeaderText( 3, "Status" );
   this.previewTree.rootDecoration = false;
   this.previewTree.alternateRowColor = true;
   this.previewTree.minHeight = 180;

   this.previewLabel = new Label( this );
   this.previewLabel.text = "Preview";

   this.previewSizer = new VerticalSizer;
   this.previewSizer.spacing = 4;
   this.previewSizer.add( this.previewLabel );
   this.previewSizer.add( this.previewTree, 100 );

   this.singleRenameLabel = new Label( this );
   this.singleRenameLabel.text = "Single Image Rename";
   this.singleRenameLabel.frameStyle = FrameStyle_Box;
   this.singleRenameLabel.margin = 4;

   this.singleRenameNameLabel = new Label( this );
   this.singleRenameNameLabel.text = "New name:";
   this.singleRenameNameLabel.textAlignment = TextAlign_Right | TextAlign_VertCenter;

   this.singleRenameEdit = new Edit( this );
   this.singleRenameEdit.toolTip = validViewIdMessage();

   this.singleRenameButton = new PushButton( this );
   this.singleRenameButton.text = "Validate Name";
   this.singleRenameButton.toolTip =
      "Check that the ad-hoc image name follows PixInsight identifier rules.";

   this.singleRenameSizer = new HorizontalSizer;
   this.singleRenameSizer.spacing = 6;
   this.singleRenameSizer.add( this.singleRenameNameLabel );
   this.singleRenameSizer.add( this.singleRenameEdit, 100 );
   this.singleRenameSizer.add( this.singleRenameButton );

   this.summaryLabel = new Label( this );
   this.summaryLabel.text = "Summary";
   this.summaryLabel.frameStyle = FrameStyle_Box;
   this.summaryLabel.margin = 4;

   this.summaryTextLabel = new Label( this );
   this.summaryTextLabel.wordWrapping = true;
   this.summaryTextLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.mappingsText = function()
   {
      return mappingsToText( mappingRows );
   };

   this.saveDialogSettings = function()
   {
      saveSettings( dialog.mappingsText(),
                    dialog.saveCheckBox.checked,
                    trimString( dialog.outputEdit.text ),
                    sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                    dialog.postSaveAction(),
                    dialog.openSavedCheckBox.checked,
                    dialog.renameMode() );
   };

   this.renameMode = function()
   {
      if ( dialog.mappingModeRadio.checked )
         return "mapping";

      if ( dialog.suffixOnlyModeRadio.checked )
         return "suffixOnly";

      if ( dialog.singleRenameModeRadio.checked )
         return "single";

      if ( dialog.saveOnlyModeRadio.checked )
         return "saveOnly";

      return "";
   };

   this.updateApplyState = function()
   {
      var hasMode = dialog.renameMode().length > 0;
      dialog.applyButton.enabled = hasMode;
      dialog.applyButton.toolTip = hasMode ?
         "Apply the selected rename/save operation." :
         "Select a rename mode before applying.";
      dialog.modePromptLabel.text = hasMode ? "" : "Select a mode to enable Apply";
      setControlBold( dialog.modePromptLabel, !hasMode );
   };

   this.updateOperationVisibility = function()
   {
      var mode = dialog.renameMode();
      var suffixVisible = mode == "suffixOnly";
      var mappingVisible = mode == "mapping";
      var singleVisible = mode == "single";

      try
      {
         dialog.suffixLabel.visible = suffixVisible;
         dialog.suffixEdit.visible = suffixVisible;
         dialog.suffixPreviewLabel.visible = suffixVisible;

         dialog.mappingLabel.visible = mappingVisible;
         dialog.mappingTree.visible = mappingVisible;
         dialog.matchLabel.visible = mappingVisible;
         dialog.matchEdit.visible = mappingVisible;
         dialog.nameLabel.visible = mappingVisible;
         dialog.nameEdit.visible = mappingVisible;
         dialog.updateMappingButton.visible = mappingVisible;
         dialog.addMappingButton.visible = mappingVisible;
         dialog.deleteMappingButton.visible = mappingVisible;

         dialog.singleRenameLabel.visible = singleVisible;
         dialog.singleRenameNameLabel.visible = singleVisible;
         dialog.singleRenameEdit.visible = singleVisible;
         dialog.singleRenameButton.visible = singleVisible;
      }
      catch ( error )
      {
      }
   };

   this.updateSaveOptionVisibility = function()
   {
      var saveVisible = dialog.saveCheckBox.checked;

      dialog.postSaveLabel.text = "After save:";
      dialog.postSaveLabel.enabled = true;
      dialog.postSaveCombo.enabled = true;
      dialog.openSavedCheckBox.enabled = saveVisible;
      dialog.renameOnlyNoteLabel.visible = !saveVisible;
      dialog.renameOnlyNoteLabel.enabled = !saveVisible;
   };

   this.postSaveAction = function()
   {
      if ( dialog.postSaveCombo.currentItem == 1 )
         return "collapse";

      if ( dialog.postSaveCombo.currentItem == 2 )
         return "close";

      return "leave";
   };

   this.selectedPreviewCount = function()
   {
      return countPreviewSelections( dialog.previewTree, currentPlan );
   };

   this.stepTitle = function( step )
   {
      if ( step == 0 )
         return "Step 1 of 6: What do you want to do?";
      if ( step == 1 )
         return "Step 2 of 6: Select your images";
      if ( step == 2 )
         return "Step 3 of 6: Select window options for open images";
      if ( step == 3 )
         return "Step 4 of 6: Save options and path";
      if ( step == 4 )
         return "Step 5 of 6: Reopen saved images";
      return "Step 6 of 6: Summary and process";
   };

   this.stepInstruction = function( step )
   {
      if ( step == 0 )
         return "Choose Rename By Filter Mappings, Append suffix to current names, Rename individual image, or Save selected images only. Enter the suffix or single-image name here when needed.";
      if ( step == 1 )
         return dialog.renameMode() == "single" ?
            "Tick exactly one open image window to rename." :
            (dialog.renameMode() == "saveOnly" ?
               "Tick the open image windows to save, then use Save && Overwrite Selected. Newly created images will prompt for a destination folder." :
               "Tick the open image windows to include in the batch.");
      if ( step == 2 )
         return "Choose what should happen to the selected source images after a save.";
      if ( step == 3 )
         return "Choose rename-only, or save renamed images to the selected folder.";
      if ( step == 4 )
         return "Choose whether saved images should be reopened after the batch completes.";
      return "Review the task. Use Process to run the selected batch operation.";
   };

   this.lastWizardStepBeforeSummary = function()
   {
      return dialog.saveCheckBox.checked ? 4 : 3;
   };

   this.nextWizardStep = function()
   {
      if ( wizardStep == 1 && dialog.renameMode() == "single" )
         return 5;

      if ( wizardStep == 1 && dialog.renameMode() == "saveOnly" )
         return 1;

      if ( wizardStep == 3 && !dialog.saveCheckBox.checked )
         return 5;

      return Math.min( 5, wizardStep + 1 );
   };

   this.previousWizardStep = function()
   {
      if ( wizardStep == 5 && dialog.renameMode() == "single" )
         return 1;

      if ( wizardStep == 5 && !dialog.saveCheckBox.checked )
         return 3;

      return Math.max( 0, wizardStep - 1 );
   };

   this.validateWizardStep = function()
   {
      if ( wizardStep == 0 && dialog.renameMode().length == 0 )
      {
         (new MessageBox( "Choose Rename By Filter Mappings, Append suffix to current names, Rename individual image, or Save selected images only before continuing.",
                          IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
         return false;
      }

      if ( wizardStep == 1 && dialog.selectedPreviewCount() == 0 )
      {
         (new MessageBox( "Select at least one image in the preview before continuing.",
                          IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
         return false;
      }

      if ( wizardStep == 1 && dialog.renameMode() == "single" )
      {
         var selectedCount = dialog.selectedPreviewCount();

         if ( selectedCount != 1 )
         {
            (new MessageBox( "Rename individual image can only process one image.\n\n" +
                             "You currently have " + selectedCount.toString() +
                             " images ticked. Untick all but one image before continuing.",
                             IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return false;
         }

         syncPreviewSelections( dialog.previewTree, currentPlan );

         if ( trimString( dialog.singleRenameEdit.text ).length == 0 )
         {
            (new MessageBox( "Enter the new image name in Step 1 before continuing.",
                             IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return false;
         }
      }

      return true;
   };

   this.summaryText = function()
   {
      syncPreviewSelections( dialog.previewTree, currentPlan );

      var modeText = dialog.renameMode() == "mapping" ?
         "Rename By Filter Mappings" :
         (dialog.renameMode() == "suffixOnly" ?
            "Append suffix to current names" :
            (dialog.renameMode() == "single" ?
               "Rename individual image" :
               "Save selected images only"));
      var selected = dialog.selectedPreviewCount();
      var matched = countMatched( currentPlan );
      var suffix = sanitizeOptionalSuffix( dialog.suffixEdit.text );
      var outputDirectory = trimString( dialog.outputEdit.text );
      var saveText = dialog.renameMode() == "single" ?
         "Single-image rename only. Files will not be saved, closed, or collapsed." :
         (dialog.renameMode() == "saveOnly" ?
         "Save-only to each existing image source folder. Newly created images will prompt for a destination folder. Images will not be renamed, closed, or collapsed." :
         (dialog.saveCheckBox.checked ?
         "Save renamed images to: " +
            (outputDirectory.length > 0 ? outputDirectory :
             "each image's source folder, where available") :
         "Rename only. Images will not be saved, closed, or collapsed."));
      var windowText = dialog.postSaveAction() == "collapse" ?
         "Collapse selected source images after save." :
         (dialog.postSaveAction() == "close" ?
            "Close selected source images after save." :
            "Leave selected source images open after save.");
      var reopenText = dialog.saveCheckBox.checked && dialog.renameMode() != "single" ?
         (dialog.openSavedCheckBox.checked ?
            "Reopen newly saved images." :
            "Do not reopen newly saved images.") :
         (dialog.renameMode() == "saveOnly" ?
            "Reopen step skipped because this is save-only overwrite." :
            "Reopen step skipped because this is rename-only.");

      return "Operation: " + modeText + "\n" +
             "Selected images: " + selected.toString() + "\n" +
             "Ready to process: " + matched.toString() + "\n" +
             (dialog.renameMode() == "single" ?
                "Only the one ticked image will be renamed.\n" +
                "New single-image name: " + trimString( dialog.singleRenameEdit.text ) + "\n" :
                "") +
             "Suffix: " + (suffix.length > 0 ? "_" + suffix : "(none)") + "\n" +
             saveText + "\n" +
             (dialog.renameMode() == "single" ? "" : windowText + "\n") +
             reopenText;
   };

   this.updateWizard = function()
   {
      for ( var i = 0; i < wizardPages.length; ++i )
      {
         try
         {
            wizardPages[i].visible = i == wizardStep;
         }
         catch ( error )
         {
         }
      }

      dialog.wizardStepLabel.text = dialog.stepTitle( wizardStep );
      dialog.wizardInstructionLabel.text = dialog.stepInstruction( wizardStep );
      dialog.backButton.enabled = wizardStep > 0;
      dialog.nextButton.visible = wizardStep < 5;
      dialog.applyButton.visible = wizardStep == 5;
      dialog.applyButton.defaultButton = wizardStep == 5;
      dialog.nextButton.defaultButton = wizardStep < 5;
      dialog.saveOverwriteButton.visible = wizardStep == 1 && dialog.renameMode() == "saveOnly";
      dialog.saveOverwriteButton.defaultButton = wizardStep == 1 && dialog.renameMode() == "saveOnly";

      if ( wizardStep == 1 && dialog.renameMode() == "saveOnly" )
         dialog.nextButton.visible = false;

      dialog.selectAllButton.text = dialog.renameMode() == "single" ?
         "Select First" :
         "Select All";

      if ( wizardStep == 1 && dialog.renameMode() == "single" )
         dialog.nextButton.text = "Next: Summary";
      else if ( wizardStep == 3 && !dialog.saveCheckBox.checked )
         dialog.nextButton.text = "Next: Summary";
      else if ( wizardStep == 4 )
         dialog.nextButton.text = "Next: Summary";
      else
         dialog.nextButton.text = "Next";

      dialog.summaryTextLabel.text = dialog.summaryText();
      dialog.updateApplyState();
      dialog.adjustToContents();
   };

   this.fillMappingTree = function()
   {
      dialog.mappingTree.clear();

      for ( var i = 0; i < mappingRows.length; ++i )
      {
         var node = new TreeBoxNode( dialog.mappingTree );
         node.__mappingIndex = i;
         node.setText( 0, mappingRows[i].match );
         node.setText( 1, mappingRows[i].imageId );
      }
   };

   this.selectMapping = function( node )
   {
      if ( node == null || typeof node.__mappingIndex != "number" )
         return;

      selectedMappingIndex = node.__mappingIndex;
      dialog.matchEdit.text = mappingRows[selectedMappingIndex].match;
      dialog.nameEdit.text = mappingRows[selectedMappingIndex].imageId;
   };

   this.refreshPreview = function()
   {
      try
      {
         var previousSelections = capturePreviewSelections( dialog.previewTree, currentPlan );
         var effectiveSuffix = sanitizeOptionalSuffix( dialog.suffixEdit.text );
         dialog.suffixPreviewLabel.text =
            effectiveSuffix.length > 0 ? "Suffix active: _" + effectiveSuffix : "";
         setControlBold( dialog.suffixEdit, effectiveSuffix.length > 0 );
         setControlBold( dialog.suffixPreviewLabel, effectiveSuffix.length > 0 );
         currentPlan = buildPlan( mappingRows,
                                  effectiveSuffix,
                                  previousSelections,
                                  dialog.renameMode() );

         if ( !outputDirectoryManuallyChanged )
         {
            var defaultDirectory = defaultOutputDirectory( currentPlan );

            if ( defaultDirectory.length > 0 &&
                 dialog.outputEdit.text != defaultDirectory )
            {
               updatingOutputDirectory = true;
               dialog.outputEdit.text = defaultDirectory;
               updatingOutputDirectory = false;
            }
         }

         fillPreview( dialog.previewTree,
                      currentPlan,
                      dialog.saveCheckBox.checked,
                      trimString( dialog.outputEdit.text ) );

         if ( dialog.renameMode() == "single" )
            enforceSinglePreviewSelection( dialog.previewTree, currentPlan );
      }
      catch ( error )
      {
         currentPlan = new Array;
         dialog.previewTree.clear();
         (new MessageBox( error.message, IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.mappingTree.onNodeSelectionUpdated = function( node )
   {
      dialog.selectMapping( node || dialog.mappingTree.currentNode );
   };

   this.mappingTree.onNodeActivated = function( node )
   {
      dialog.selectMapping( node || dialog.mappingTree.currentNode );
   };

   this.addMappingButton.onClick = function()
   {
      var match = trimString( dialog.matchEdit.text );
      var name = trimString( dialog.nameEdit.text );

      if ( match.length == 0 || name.length == 0 )
      {
         (new MessageBox( "Enter both a match value and an image name.",
                          IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return;
      }

      mappingRows.push( {
         match: match,
         imageId: sanitizeViewId( name ),
         line: mappingRows.length + 1
      } );
      selectedMappingIndex = mappingRows.length - 1;
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.updateMappingButton.onClick = function()
   {
      if ( selectedMappingIndex < 0 || selectedMappingIndex >= mappingRows.length )
      {
         (new MessageBox( "Select a mapping row to update.",
                          IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
         return;
      }

      var match = trimString( dialog.matchEdit.text );
      var name = trimString( dialog.nameEdit.text );

      if ( match.length == 0 || name.length == 0 )
      {
         (new MessageBox( "Enter both a match value and an image name.",
                          IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
         return;
      }

      mappingRows[selectedMappingIndex].match = match;
      mappingRows[selectedMappingIndex].imageId = sanitizeViewId( name );
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.deleteMappingButton.onClick = function()
   {
      if ( selectedMappingIndex < 0 || selectedMappingIndex >= mappingRows.length )
      {
         (new MessageBox( "Select a mapping row to delete.",
                          IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
         return;
      }

      mappingRows.splice( selectedMappingIndex, 1 );
      selectedMappingIndex = -1;
      dialog.matchEdit.text = "";
      dialog.nameEdit.text = "";
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.outputEdit.onTextUpdated = function()
   {
      if ( !updatingOutputDirectory )
         outputDirectoryManuallyChanged = true;

      dialog.saveDialogSettings();
      fillPreview( dialog.previewTree,
                   currentPlan,
                   dialog.saveCheckBox.checked,
                   trimString( dialog.outputEdit.text ) );
      dialog.updateWizard();
   };

   this.saveCheckBox.onCheck = function()
   {
      dialog.saveDialogSettings();
      dialog.updateSaveOptionVisibility();
      dialog.refreshPreview();
      dialog.updateWizard();
   };

   this.suffixEdit.onTextUpdated = function()
   {
      dialog.saveDialogSettings();
      dialog.refreshPreview();
      dialog.updateWizard();
   };

   this.singleRenameEdit.onTextUpdated = function()
   {
      dialog.updateWizard();
   };

   this.mappingModeRadio.onCheck = function()
   {
      if ( dialog.mappingModeRadio.checked )
      {
         dialog.suffixOnlyModeRadio.checked = false;
         dialog.singleRenameModeRadio.checked = false;
         dialog.saveOnlyModeRadio.checked = false;
      }
      dialog.saveDialogSettings();
      dialog.updateApplyState();
      dialog.updateOperationVisibility();
      dialog.refreshPreview();
      dialog.updateWizard();
   };

   this.suffixOnlyModeRadio.onCheck = function()
   {
      if ( dialog.suffixOnlyModeRadio.checked )
      {
         dialog.mappingModeRadio.checked = false;
         dialog.singleRenameModeRadio.checked = false;
         dialog.saveOnlyModeRadio.checked = false;
      }
      dialog.saveDialogSettings();
      dialog.updateApplyState();
      dialog.updateOperationVisibility();
      dialog.refreshPreview();
      dialog.updateWizard();
   };

   this.singleRenameModeRadio.onCheck = function()
   {
      if ( dialog.singleRenameModeRadio.checked )
      {
         dialog.mappingModeRadio.checked = false;
         dialog.suffixOnlyModeRadio.checked = false;
         dialog.saveOnlyModeRadio.checked = false;
      }
      dialog.saveDialogSettings();
      dialog.updateApplyState();
      dialog.updateOperationVisibility();
      dialog.refreshPreview();
      dialog.updateWizard();
   };

   this.saveOnlyModeRadio.onCheck = function()
   {
      if ( dialog.saveOnlyModeRadio.checked )
      {
         dialog.mappingModeRadio.checked = false;
         dialog.suffixOnlyModeRadio.checked = false;
         dialog.singleRenameModeRadio.checked = false;
      }
      dialog.saveDialogSettings();
      dialog.updateApplyState();
      dialog.updateOperationVisibility();
      dialog.refreshPreview();
      dialog.updateWizard();
   };

   this.postSaveCombo.onItemSelected = function()
   {
      dialog.saveDialogSettings();
      dialog.updateWizard();
   };

   this.openSavedCheckBox.onCheck = function()
   {
      dialog.saveDialogSettings();
      dialog.updateWizard();
   };

   this.resetButton = new PushButton( this );
   this.resetButton.text = "Default Mappings";
   this.resetButton.onClick = function()
   {
      mappingRows = parseMappings( DEFAULT_MAPPINGS );
      selectedMappingIndex = -1;
      dialog.matchEdit.text = "";
      dialog.nameEdit.text = "";
      dialog.fillMappingTree();
      dialog.saveDialogSettings();
      dialog.refreshPreview();
   };

   this.refreshButton = new PushButton( this );
   this.refreshButton.text = "Refresh";
   this.refreshButton.icon = this.scaledResource( ":/icons/reload.png" );
   this.refreshButton.onClick = function()
   {
      dialog.refreshPreview();
   };

   this.helpButton = new PushButton( this );
   this.helpButton.text = "?";
   this.helpButton.toolTip = "Show help for ImageBatchManager.";
   this.helpButton.onClick = function()
   {
      showHelpDialog();
   };

   this.selectAllButton = new PushButton( this );
   this.selectAllButton.text = "Select All";
   this.selectAllButton.onClick = function()
   {
      if ( dialog.renameMode() == "single" )
      {
         setPreviewSelections( dialog.previewTree, currentPlan, false );

         if ( currentPlan.length > 0 )
            currentPlan[0].selected = true;
      }
      else
         setPreviewSelections( dialog.previewTree, currentPlan, true );

      fillPreview( dialog.previewTree,
                   currentPlan,
                   dialog.saveCheckBox.checked,
                   trimString( dialog.outputEdit.text ) );

      if ( dialog.renameMode() == "single" )
         enforceSinglePreviewSelection( dialog.previewTree, currentPlan );
   };

   this.unselectAllButton = new PushButton( this );
   this.unselectAllButton.text = "Unselect All";
   this.unselectAllButton.onClick = function()
   {
      setPreviewSelections( dialog.previewTree, currentPlan, false );
      fillPreview( dialog.previewTree,
                   currentPlan,
                   dialog.saveCheckBox.checked,
                   trimString( dialog.outputEdit.text ) );
   };

   this.singleRenameButton.onClick = function()
   {
      try
      {
         var newId = trimString( dialog.singleRenameEdit.text );

         if ( newId.length == 0 )
            throw new Error( "Enter a new image name." );

         if ( !isValidViewId( newId ) )
            throw new Error( "Invalid PixInsight identifier: " + newId + "\n\n" +
                             validViewIdMessage() );

         (new MessageBox( "The image name is valid.",
                          IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
      }
      catch ( error )
      {
         (new MessageBox( error.message, IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.applyButton = new PushButton( this );
   this.applyButton.text = "Apply Changes";
   this.applyButton.icon = this.scaledResource( ":/icons/execute.png" );
   this.applyButton.defaultButton = true;
   this.applyButton.onClick = function()
   {
      try
      {
         currentPlan = buildPlan( mappingRows,
                                  sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                                  capturePreviewSelections( dialog.previewTree, currentPlan ),
                                  dialog.renameMode() );

         if ( dialog.renameMode().length == 0 )
         {
            (new MessageBox( "Select a rename mode before applying.",
                             IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return;
         }

         if ( dialog.renameMode() == "single" )
         {
            renameSingleSelectedImage( currentPlan,
                                       dialog.singleRenameEdit.text );
            dialog.singleRenameEdit.text = "";
            dialog.ok();
            return;
         }

         var matched = countMatched( currentPlan );
         if ( matched == 0 )
         {
            (new MessageBox( "No open image windows match the current mappings.",
                             IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return;
         }

         var outputDirectory = trimString( dialog.outputEdit.text );
         var message =
            "Rename " + matched.toString() + " image window(s) using the current mappings?";

         if ( dialog.saveCheckBox.checked )
            message += "\n\nImages will also be saved to:\n" +
                       (outputDirectory.length > 0 ? outputDirectory :
                         "each image's source folder, where available");

         if ( (new MessageBox( message, IMAGE_RENAME_TITLE, StdIcon_Question,
                               StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
            return;

         if ( dialog.saveCheckBox.checked )
         {
            if ( !confirmOverwrites( currentPlan, outputDirectory ) )
               return;
         }

         saveSettings( dialog.mappingsText(),
                       dialog.saveCheckBox.checked,
                       outputDirectory,
                       sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                       dialog.postSaveAction(),
                       dialog.openSavedCheckBox.checked,
                       dialog.renameMode() );

         dialog.ok();
         applyPlan( currentPlan,
                    dialog.saveCheckBox.checked,
                    outputDirectory,
                    dialog.postSaveAction(),
                    dialog.openSavedCheckBox.checked );
      }
      catch ( error )
      {
         (new MessageBox( error.message, IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.saveOverwriteButton = new PushButton( this );
   this.saveOverwriteButton.text = "Save && Overwrite Selected";
   this.saveOverwriteButton.icon = this.scaledResource( ":/icons/save.png" );
   this.saveOverwriteButton.toolTip =
      "Save source-backed images to their existing folders. If selected images were created in PixInsight, choose one folder for those new images. This does not rename, close, or collapse images.";
   this.saveOverwriteButton.onClick = function()
   {
      try
      {
         if ( dialog.renameMode() != "saveOnly" )
         {
            (new MessageBox( "Choose Save selected images only on Step 1 before using this action.",
                             IMAGE_RENAME_TITLE, StdIcon_Information, StdButton_Ok )).execute();
            return;
         }

         currentPlan = buildPlan( mappingRows,
                                  sanitizeOptionalSuffix( dialog.suffixEdit.text ),
                                  capturePreviewSelections( dialog.previewTree, currentPlan ),
                                  dialog.renameMode() );
         overwriteSelectedCurrentFiles( currentPlan, "" );
      }
      catch ( error )
      {
         (new MessageBox( error.message, IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.selectionActionLabel = new Label( this );
   this.selectionActionLabel.text = "Preview Selection";
   this.selectionActionLabel.frameStyle = FrameStyle_Box;
   this.selectionActionLabel.margin = 4;

   this.selectionButtonSizer = new HorizontalSizer;
   this.selectionButtonSizer.spacing = 6;
   this.selectionButtonSizer.add( this.selectAllButton );
   this.selectionButtonSizer.add( this.unselectAllButton );
   this.selectionButtonSizer.add( this.saveOverwriteButton );
   this.selectionButtonSizer.addStretch();

   this.closeButton = new PushButton( this );
   this.closeButton.text = "Close";
   this.closeButton.icon = this.scaledResource( ":/icons/close.png" );
   this.closeButton.onClick = function()
   {
      dialog.saveDialogSettings();
      dialog.cancel();
   };

   this.backButton = new PushButton( this );
   this.backButton.text = "Back";
   this.backButton.onClick = function()
   {
      wizardStep = dialog.previousWizardStep();
      dialog.updateWizard();
   };

   this.nextButton = new PushButton( this );
   this.nextButton.text = "Next";
   this.nextButton.onClick = function()
   {
      if ( !dialog.validateWizardStep() )
         return;

      dialog.refreshPreview();

      wizardStep = dialog.nextWizardStep();
      dialog.updateWizard();
   };

   this.pageOperation = new Control( this );
   this.pageOperation.sizer = new VerticalSizer;
   this.pageOperation.sizer.spacing = 8;
   this.pageOperation.sizer.add( this.optionsHeaderLabel );
   this.pageOperation.sizer.add( this.modeSizer );
   this.pageOperation.sizer.add( this.suffixSizer );
   this.pageOperation.sizer.add( this.singleRenameLabel );
   this.pageOperation.sizer.add( this.singleRenameSizer );
   this.pageOperation.sizer.add( this.mappingSizer, 100 );

   this.pageSelection = new Control( this );
   this.pageSelection.sizer = new VerticalSizer;
   this.pageSelection.sizer.spacing = 8;
   this.pageSelection.sizer.add( this.previewSizer, 100 );
   this.pageSelection.sizer.add( this.selectionActionLabel );
   this.pageSelection.sizer.add( this.selectionButtonSizer );

   this.pageWindowOptions = new Control( this );
   this.pageWindowOptions.sizer = new VerticalSizer;
   this.pageWindowOptions.sizer.spacing = 8;
   this.pageWindowOptions.sizer.add( this.postSaveSizer );
   this.pageWindowOptions.sizer.add( this.windowOptionsNoteLabel );

   this.pageSaveOptions = new Control( this );
   this.pageSaveOptions.sizer = new VerticalSizer;
   this.pageSaveOptions.sizer.spacing = 8;
   this.pageSaveOptions.sizer.add( this.saveCheckBox );
   this.pageSaveOptions.sizer.add( this.folderSizer );
   this.pageSaveOptions.sizer.add( this.renameOnlyNoteLabel );

   this.pageReopen = new Control( this );
   this.pageReopen.sizer = new VerticalSizer;
   this.pageReopen.sizer.spacing = 8;
   this.pageReopen.sizer.add( this.openSavedCheckBox );

   this.pageSummary = new Control( this );
   this.pageSummary.sizer = new VerticalSizer;
   this.pageSummary.sizer.spacing = 8;
   this.pageSummary.sizer.add( this.summaryLabel );
   this.pageSummary.sizer.add( this.summaryTextLabel );

   wizardPages.push( this.pageOperation );
   wizardPages.push( this.pageSelection );
   wizardPages.push( this.pageWindowOptions );
   wizardPages.push( this.pageSaveOptions );
   wizardPages.push( this.pageReopen );
   wizardPages.push( this.pageSummary );

   this.buttonSizer = new HorizontalSizer;
   this.buttonSizer.spacing = 6;
   this.buttonSizer.add( this.resetButton );
   this.buttonSizer.add( this.refreshButton );
   this.buttonSizer.add( this.helpButton );
   this.buttonSizer.addStretch();
   this.buttonSizer.add( this.backButton );
   this.buttonSizer.add( this.nextButton );
   this.buttonSizer.add( this.applyButton );
   this.buttonSizer.add( this.closeButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.infoLabel );
   this.sizer.add( this.wizardStepLabel );
   this.sizer.add( this.wizardInstructionLabel );
   this.sizer.add( this.pageOperation, 100 );
   this.sizer.add( this.pageSelection, 100 );
   this.sizer.add( this.pageWindowOptions, 100 );
   this.sizer.add( this.pageSaveOptions, 100 );
   this.sizer.add( this.pageReopen, 100 );
   this.sizer.add( this.pageSummary, 100 );
   this.sizer.add( this.buttonSizer );

   this.fillMappingTree();
   this.refreshPreview();
   this.updateApplyState();
   this.updateSaveOptionVisibility();
   this.updateOperationVisibility();
   this.updateWizard();

   this.adjustToContents();
   this.setMinWidth( 760 );
}

ImageRenameByFilterDialog.prototype = new Dialog;

function runImageRenameByFilter()
{
   if ( ImageWindow.windows.length == 0 )
   {
      (new MessageBox( "Open at least one image window before running this script.",
                       IMAGE_RENAME_TITLE, StdIcon_Error, StdButton_Ok )).execute();
      return;
   }

   var dialog = new ImageRenameByFilterDialog;
   dialog.execute();
}

runImageRenameByFilter();
