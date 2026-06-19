// ImageDisplayManager.js
//
// PixInsight JavaScript Runtime script.
//
// Copyright (c) 2026 Ian Steane. All rights reserved.
// Public visibility is for PixInsight update distribution only. No permission
// is granted to copy, modify, redistribute, repackage, sell, sublicense, or
// create derivative works without prior written permission.
//
// Combined batch ScreenTransferFunction and image-window matching utility.

#feature-id    ImageDisplayManager : Chapel Astro Utilities > ImageDisplayManager
#feature-info  Apply or reset automatic screen stretches, then match open image windows to a selected reference.

var TITLE = "ImageDisplayManager";
var VERSION = "1.0.0-beta2";

var FrameStyle_Box = 1;
var ResizeMode_AbsolutePixels = 1;
var AbsoluteResizeMode_ForceWidthAndHeight = 0;
var StdButton_Ok = 1;
var StdButton_Yes = 3;
var StdButton_No = 4;
var StdIcon_Question = 1;
var StdIcon_Information = 2;
var StdIcon_Error = 4;
var TextAlign_Left = 0x01;
var TextAlign_Right = 0x02;
var TextAlign_VertCenter = 0x80;
var UndoFlag_DefaultMode = 0x00000000;

var SHADOWS_CLIPPING = -2.80;
var TARGET_BACKGROUND = 0.25;

function HorizontalSizer()
{
   this.__base__ = Sizer;
   this.__base__( false );
}
HorizontalSizer.prototype = new Sizer;

function VerticalSizer()
{
   this.__base__ = Sizer;
   this.__base__( true );
}
VerticalSizer.prototype = new Sizer;

function identitySTF()
{
   return [
      [0, 1, 0.5, 0, 1],
      [0, 1, 0.5, 0, 1],
      [0, 1, 0.5, 0, 1],
      [0, 1, 0.5, 0, 1]
   ];
}

function isCollapsedWindow( window )
{
   try
   {
      if ( typeof window.isIconic == "boolean" )
         return window.isIconic;
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( typeof window.iconic == "boolean" )
         return window.iconic;
   }
   catch ( error2 )
   {
   }

   return false;
}

function channelValue( vector, channel )
{
   return vector.at( channel );
}

function linkedAutoSTF( median, mad, channelCount )
{
   var invertedChannels = 0;

   for ( var c = 0; c < channelCount; ++c )
      if ( channelValue( median, c ) > 0.5 )
         ++invertedChannels;

   var medianSum = 0;
   var clippingSum = 0;
   var row;

   if ( invertedChannels < channelCount )
   {
      for ( var nc = 0; nc < channelCount; ++nc )
      {
         if ( 1 + channelValue( mad, nc ) != 1 )
            clippingSum += channelValue( median, nc ) +
                           SHADOWS_CLIPPING*channelValue( mad, nc );
         medianSum += channelValue( median, nc );
      }

      var c0 = Math.range( clippingSum/channelCount, 0.0, 1.0 );
      var m = Math.mtf( TARGET_BACKGROUND, medianSum/channelCount - c0 );
      row = [c0, 1, m, 0, 1];
   }
   else
   {
      for ( var ic = 0; ic < channelCount; ++ic )
      {
         medianSum += channelValue( median, ic );
         if ( 1 + channelValue( mad, ic ) != 1 )
            clippingSum += channelValue( median, ic ) -
                           SHADOWS_CLIPPING*channelValue( mad, ic );
         else
            clippingSum += 1;
      }

      var c1 = Math.range( clippingSum/channelCount, 0.0, 1.0 );
      var invertedM = Math.mtf(
         c1 - medianSum/channelCount, TARGET_BACKGROUND );
      row = [0, c1, invertedM, 0, 1];
   }

   return [row, row, row, [0, 1, 0.5, 0, 1]];
}

function unlinkedAutoSTF( median, mad, channelCount )
{
   var stf = identitySTF();

   for ( var c = 0; c < channelCount; ++c )
   {
      var channelMedian = channelValue( median, c );
      var channelMad = channelValue( mad, c );

      if ( channelMedian < 0.5 )
      {
         var c0 = 1 + channelMad != 1 ?
            Math.range( channelMedian + SHADOWS_CLIPPING*channelMad,
                        0.0, 1.0 ) :
            0.0;
         var m = Math.mtf( TARGET_BACKGROUND, channelMedian - c0 );
         stf[c] = [c0, 1, m, 0, 1];
      }
      else
      {
         var c1 = 1 + channelMad != 1 ?
            Math.range( channelMedian - SHADOWS_CLIPPING*channelMad,
                        0.0, 1.0 ) :
            1.0;
         var invertedM = Math.mtf(
            c1 - channelMedian, TARGET_BACKGROUND );
         stf[c] = [0, c1, invertedM, 0, 1];
      }
   }

   if ( channelCount == 1 )
   {
      stf[1] = stf[0];
      stf[2] = stf[0];
   }

   return stf;
}

function calculateAutoSTF( view, linked )
{
   var channelCount = view.image.isColor ? 3 : 1;
   var median = view.computeOrFetchProperty( "Median" );
   var mad = view.computeOrFetchProperty( "MAD" );

   mad.mul( 1.4826 );

   return linked ?
      linkedAutoSTF( median, mad, channelCount ) :
      unlinkedAutoSTF( median, mad, channelCount );
}

function applySTF( view, values )
{
   var process = new ScreenTransferFunction;
   process.STF = values;

   if ( !process.executeOn( view ) )
      throw new Error( "ScreenTransferFunction failed on " + view.id + "." );
}

function selectedWindows( tree )
{
   var selected = new Array;
   var windows = ImageWindow.windows;

   for ( var i = 0; i < tree.numberOfChildren; ++i )
   {
      var node = tree.child( i );

      if ( node != null && node.checked &&
           typeof node.__windowIndex == "number" &&
           node.__windowIndex < windows.length )
      {
         var window = windows[node.__windowIndex];
         if ( window.mainView.id == node.__viewId )
            selected.push( window );
      }
   }

   return selected;
}

function setAllSelections( tree, checked )
{
   for ( var i = 0; i < tree.numberOfChildren; ++i )
   {
      var node = tree.child( i );
      if ( node != null )
         node.checked = checked;
   }
}

function fillImageTree( tree )
{
   tree.clear();
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
   {
      var window = windows[i];
      var view = window.mainView;
      var node = new TreeBoxNode( tree );

      node.__windowIndex = i;
      node.__viewId = view.id;
      node.checkable = true;
      node.checked = !isCollapsedWindow( window );
      node.setText( 0, view.id );
      node.setText( 1, view.image.isColor ? "Color" : "Monochrome" );
      node.setText( 2, view.image.width.toString() + " x " +
                       view.image.height.toString() );
      node.setText( 3, isCollapsedWindow( window ) ? "Collapsed" : "Open" );
   }

   try
   {
      tree.setColumnWidth( 0, 250 );
      tree.setColumnWidth( 1, 105 );
      tree.setColumnWidth( 2, 125 );
      tree.setColumnWidth( 3, 90 );
   }
   catch ( error )
   {
   }
}

function windowByMainViewId( id )
{
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
      if ( windows[i].mainView.id == id )
         return windows[i];

   return ImageWindow.windowById( "__ImageDisplayManager_NoSuchWindow__" );
}

function fillReferenceCombo( combo, preferredId )
{
   combo.clear();
   var windows = ImageWindow.windows;
   var selectedIndex = 0;

   for ( var i = 0; i < windows.length; ++i )
   {
      var id = windows[i].mainView.id;
      combo.addItem( id );
      if ( id == preferredId )
         selectedIndex = i;
   }

   if ( windows.length > 0 )
      combo.currentItem = selectedIndex;
}

function formatSize( image )
{
   return image.width.toString() + " x " + image.height.toString();
}

function zoomText( zoom )
{
   if ( zoom > 0 )
      return zoom.toString() + ":1";
   if ( zoom < 0 )
      return "1:" + (-zoom).toString();
   return "current";
}

function captureGeometry( window )
{
   var hasFrameRect = typeof window.frameRect != "undefined";
   var frameWidth = 0;
   var frameHeight = 0;

   try
   {
      if ( hasFrameRect )
      {
         frameWidth = window.frameRect.width;
         frameHeight = window.frameRect.height;
      }
   }
   catch ( error )
   {
      hasFrameRect = false;
   }

   return {
      hasSize: typeof window.width == "number" &&
               typeof window.height == "number",
      width: typeof window.width == "number" ? window.width : 0,
      height: typeof window.height == "number" ? window.height : 0,
      hasFrameRect: hasFrameRect,
      frameWidth: frameWidth,
      frameHeight: frameHeight,
      zoom: window.zoomFactor
   };
}

function resizeImageToReference( targetWindow, width, height )
{
   var view = targetWindow.mainView;

   view.beginProcess( UndoFlag_DefaultMode );
   view.image.resample( width,
                        height,
                        ResizeMode_AbsolutePixels,
                        AbsoluteResizeMode_ForceWidthAndHeight );
   view.endProcess();
}

function copyReferenceFrame( targetWindow, geometry )
{
   try
   {
      if ( geometry.hasSize && typeof targetWindow.resize == "function" )
      {
         targetWindow.resize( geometry.width, geometry.height );
         return "resize()";
      }
   }
   catch ( error1 )
   {
   }

   try
   {
      if ( geometry.hasSize &&
           typeof targetWindow.width == "number" &&
           typeof targetWindow.height == "number" )
      {
         targetWindow.width = geometry.width;
         targetWindow.height = geometry.height;
         return "width/height";
      }
   }
   catch ( error2 )
   {
   }

   try
   {
      if ( geometry.hasFrameRect &&
           typeof targetWindow.frameRect != "undefined" &&
           typeof targetWindow.position != "undefined" )
      {
         var p = targetWindow.position;
         targetWindow.frameRect = new Rect(
            p.x, p.y, p.x + geometry.frameWidth, p.y + geometry.frameHeight );
         return "frameRect";
      }
   }
   catch ( error3 )
   {
   }

   return "";
}

function matchWindowsToReference( referenceWindow )
{
   if ( referenceWindow.isNull )
      throw new Error( "Select a valid reference image." );

   var referenceView = referenceWindow.mainView;
   var referenceImage = referenceView.image;
   var referenceWidth = referenceImage.width;
   var referenceHeight = referenceImage.height;
   var geometry = captureGeometry( referenceWindow );
   var targets = new Array;
   var windows = ImageWindow.windows;

   for ( var i = 0; i < windows.length; ++i )
      if ( windows[i].mainView.id != referenceView.id )
         targets.push( windows[i] );

   if ( targets.length == 0 )
      throw new Error( "There are no other open image windows to match." );

   var message =
      "Reference image: " + referenceView.id + "\n" +
      "Reference size: " + formatSize( referenceImage ) + " px\n" +
      "Reference zoom: " + zoomText( geometry.zoom ) + "\n\n" +
      "The reference image will not be changed.\n\n" +
      "All other open images will be matched to its zoom and window frame. " +
      "Images with different pixel dimensions will be resampled.";

   if ( (new MessageBox( message, TITLE, StdIcon_Question,
                         StdButton_Yes, StdButton_No )).execute() != StdButton_Yes )
      return null;

   var resized = 0;
   var frames = 0;

   Console.show();
   Console.writeln( "<end><cbr><br>" + TITLE + " " + VERSION );
   Console.writeln( "Reference: " + referenceView.id );

   for ( var j = 0; j < targets.length; ++j )
   {
      var target = targets[j];

      if ( target.mainView.image.width != referenceWidth ||
           target.mainView.image.height != referenceHeight )
      {
         resizeImageToReference( target, referenceWidth, referenceHeight );
         ++resized;
      }

      target.zoomFactor = geometry.zoom;

      var frameMethod = copyReferenceFrame( target, geometry );
      if ( frameMethod.length > 0 )
      {
         ++frames;
         target.zoomFactor = geometry.zoom;
      }
      else
         Console.warningln( "Could not copy frame for " +
                            target.mainView.id + "." );
   }

   referenceWindow.bringToFront();
   return {
      targetCount: targets.length,
      resized: resized,
      frames: frames
   };
}

function ImageDisplayManagerDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var dialog = this;
   this.windowTitle = TITLE + " " + VERSION;
   this.minWidth = 680;

   this.introduction = new Label( this );
   this.introduction.text =
      "Use the upper section to control the display stretch, then use the " +
      "lower section to make the open image windows match a reference image. " +
      "This modeless window can remain open while you select and inspect images.";
   this.introduction.wordWrapping = true;
   this.introduction.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   // Upper section: Batch Auto Stretch.
   this.stretchGroup = new GroupBox( this );
   this.stretchGroup.title = "1. Batch Auto Stretch";

   this.stretchInfo = new Label( this.stretchGroup );
   this.stretchInfo.text =
      "Tick the images to stretch. This changes only their screen display; " +
      "the underlying image pixels are not altered.";
   this.stretchInfo.wordWrapping = true;
   this.stretchInfo.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.imageTree = new TreeBox( this.stretchGroup );
   this.imageTree.numberOfColumns = 4;
   this.imageTree.headerVisible = true;
   this.imageTree.setHeaderText( 0, "Image" );
   this.imageTree.setHeaderText( 1, "Type" );
   this.imageTree.setHeaderText( 2, "Dimensions" );
   this.imageTree.setHeaderText( 3, "Window" );
   this.imageTree.rootDecoration = false;
   this.imageTree.alternateRowColor = true;
   this.imageTree.minHeight = 190;

   this.selectAllButton = new PushButton( this.stretchGroup );
   this.selectAllButton.text = "Select All";
   this.selectAllButton.onClick = function()
   {
      setAllSelections( dialog.imageTree, true );
   };

   this.selectNoneButton = new PushButton( this.stretchGroup );
   this.selectNoneButton.text = "Select None";
   this.selectNoneButton.onClick = function()
   {
      setAllSelections( dialog.imageTree, false );
   };

   this.linkedRadio = new RadioButton( this.stretchGroup );
   this.linkedRadio.text = "Linked";
   this.linkedRadio.checked = true;

   this.unlinkedRadio = new RadioButton( this.stretchGroup );
   this.unlinkedRadio.text = "Unlinked";

   this.stretchModeLabel = new Label( this.stretchGroup );
   this.stretchModeLabel.text = "Stretch mode:";
   this.stretchModeLabel.textAlignment =
      TextAlign_Right | TextAlign_VertCenter;

   this.stretchControls = new HorizontalSizer;
   this.stretchControls.spacing = 8;
   this.stretchControls.add( this.selectAllButton );
   this.stretchControls.add( this.selectNoneButton );
   this.stretchControls.addStretch();
   this.stretchControls.add( this.stretchModeLabel );
   this.stretchControls.add( this.linkedRadio );
   this.stretchControls.add( this.unlinkedRadio );

   this.applyStretchButton = new PushButton( this.stretchGroup );
   this.applyStretchButton.text = "Apply Auto Stretch";
   this.applyStretchButton.icon =
      this.scaledResource( ":/icons/execute.png" );

   this.resetStretchButton = new PushButton( this.stretchGroup );
   this.resetStretchButton.text = "Reset Screen Transfer";

   this.stretchActionSizer = new HorizontalSizer;
   this.stretchActionSizer.spacing = 8;
   this.stretchActionSizer.add( this.applyStretchButton );
   this.stretchActionSizer.add( this.resetStretchButton );
   this.stretchActionSizer.addStretch();

   this.stretchGroup.sizer = new VerticalSizer;
   this.stretchGroup.sizer.margin = 10;
   this.stretchGroup.sizer.spacing = 8;
   this.stretchGroup.sizer.add( this.stretchInfo );
   this.stretchGroup.sizer.add( this.imageTree, 100 );
   this.stretchGroup.sizer.add( this.stretchControls );
   this.stretchGroup.sizer.add( this.stretchActionSizer );

   // Lower section: Match Image Sizes.
   this.matchGroup = new GroupBox( this );
   this.matchGroup.title = "2. Match Image Sizes";

   this.matchInfo = new Label( this.matchGroup );
   this.matchInfo.text =
      "Choose one reference image. Every other open image will copy its zoom " +
      "and window frame; images with different pixel dimensions will be resampled.";
   this.matchInfo.wordWrapping = true;
   this.matchInfo.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.referenceLabel = new Label( this.matchGroup );
   this.referenceLabel.text = "Reference image:";
   this.referenceLabel.textAlignment =
      TextAlign_Right | TextAlign_VertCenter;

   this.referenceCombo = new ComboBox( this.matchGroup );

   this.useActiveButton = new PushButton( this.matchGroup );
   this.useActiveButton.text = "Use Active Image";
   this.useActiveButton.toolTip =
      "Use the currently active PixInsight image window as the size reference.";

   this.referenceSizer = new HorizontalSizer;
   this.referenceSizer.spacing = 8;
   this.referenceSizer.add( this.referenceLabel );
   this.referenceSizer.add( this.referenceCombo, 100 );
   this.referenceSizer.add( this.useActiveButton );

   this.matchButton = new PushButton( this.matchGroup );
   this.matchButton.text = "Match Other Images To Reference";
   this.matchButton.icon = this.scaledResource( ":/icons/execute.png" );

   this.matchActionSizer = new HorizontalSizer;
   this.matchActionSizer.add( this.matchButton );
   this.matchActionSizer.addStretch();

   this.matchGroup.sizer = new VerticalSizer;
   this.matchGroup.sizer.margin = 10;
   this.matchGroup.sizer.spacing = 8;
   this.matchGroup.sizer.add( this.matchInfo );
   this.matchGroup.sizer.add( this.referenceSizer );
   this.matchGroup.sizer.add( this.matchActionSizer );

   this.statusLabel = new Label( this );
   this.statusLabel.frameStyle = FrameStyle_Box;
   this.statusLabel.margin = 6;
   this.statusLabel.wordWrapping = true;
   this.statusLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.refreshButton = new PushButton( this );
   this.refreshButton.text = "Refresh Open Images";

   this.closeButton = new PushButton( this );
   this.closeButton.text = "Close";
   this.closeButton.icon = this.scaledResource( ":/icons/close.png" );

   this.footerSizer = new HorizontalSizer;
   this.footerSizer.spacing = 8;
   this.footerSizer.add( this.refreshButton );
   this.footerSizer.addStretch();
   this.footerSizer.add( this.closeButton );

   this.refreshImages = function()
   {
      var currentReference = "";

      if ( dialog.referenceCombo.numberOfItems > 0 )
         currentReference = dialog.referenceCombo.itemText(
            dialog.referenceCombo.currentItem );

      if ( currentReference.length == 0 && !ImageWindow.activeWindow.isNull )
         currentReference = ImageWindow.activeWindow.mainView.id;

      fillImageTree( dialog.imageTree );
      fillReferenceCombo( dialog.referenceCombo, currentReference );

      var count = ImageWindow.windows.length;
      dialog.statusLabel.text =
         count.toString() + " open image window(s) available.";
      dialog.matchButton.enabled = count > 1;
      dialog.applyStretchButton.enabled = count > 0;
      dialog.resetStretchButton.enabled = count > 0;
   };

   this.runStretch = function( reset )
   {
      try
      {
         var windows = selectedWindows( dialog.imageTree );
         if ( windows.length == 0 )
            throw new Error( "Select at least one image in the upper section." );

         Console.show();
         Console.writeln( "<end><cbr><br>" + TITLE + " " + VERSION );

         for ( var i = 0; i < windows.length; ++i )
         {
            var view = windows[i].mainView;
            applySTF( view,
                      reset ?
                         identitySTF() :
                         calculateAutoSTF( view,
                                           dialog.linkedRadio.checked ) );
         }

         dialog.statusLabel.text =
            (reset ? "Reset the screen transfer on " :
                     "Applied automatic screen stretch to ") +
            windows.length.toString() + " image(s).";
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE,
                          StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.applyStretchButton.onClick = function()
   {
      dialog.runStretch( false );
   };

   this.resetStretchButton.onClick = function()
   {
      dialog.runStretch( true );
   };

   this.matchButton.onClick = function()
   {
      try
      {
         if ( dialog.referenceCombo.numberOfItems == 0 )
            throw new Error( "Select a reference image." );

         var id = dialog.referenceCombo.itemText(
            dialog.referenceCombo.currentItem );
         var result = matchWindowsToReference( windowByMainViewId( id ) );

         if ( result != null )
         {
            dialog.refreshImages();
            dialog.statusLabel.text =
               "Matched " + result.targetCount.toString() +
               " image(s) to " + id + ". Resampled " +
               result.resized.toString() + "; copied " +
               result.frames.toString() + " window frame(s).";
         }
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE,
                          StdIcon_Error, StdButton_Ok )).execute();
      }
   };

   this.refreshButton.onClick = function()
   {
      dialog.refreshImages();
   };

   this.useActiveButton.onClick = function()
   {
      try
      {
         if ( ImageWindow.activeWindow.isNull )
            throw new Error( "Click an image window in the PixInsight workspace first." );

         var activeId = ImageWindow.activeWindow.mainView.id;
         fillReferenceCombo( dialog.referenceCombo, activeId );
         dialog.statusLabel.text =
            "Reference image set to the active image: " + activeId + ".";
      }
      catch ( error )
      {
         (new MessageBox( error.message, TITLE,
                          StdIcon_Information, StdButton_Ok )).execute();
      }
   };

   this.closeButton.onClick = function()
   {
      dialog.cancel();
   };

   this.sizer = new VerticalSizer;
   this.sizer.margin = 10;
   this.sizer.spacing = 12;
   this.sizer.add( this.introduction );
   this.sizer.add( this.stretchGroup, 100 );
   this.sizer.add( this.matchGroup );
   this.sizer.add( this.statusLabel );
   this.sizer.add( this.footerSizer );

   this.refreshImages();
   this.adjustToContents();
}
ImageDisplayManagerDialog.prototype = new Dialog;

function main()
{
   if ( ImageWindow.windows.length == 0 )
   {
      (new MessageBox( "Open at least one image before running this utility.",
                       TITLE, StdIcon_Information, StdButton_Ok )).execute();
      return;
   }

   var dialog = new ImageDisplayManagerDialog;
   dialog.show();

   /*
    * Keep the JavaScript instance alive while allowing PixInsight to process
    * workspace interaction. This is intentionally modeless: users can click
    * image windows, change the active image, and return to this utility.
    */
   while ( dialog.visible )
   {
      CoreApplication.processEvents();
      msleep( 20 );
   }
}

main();
