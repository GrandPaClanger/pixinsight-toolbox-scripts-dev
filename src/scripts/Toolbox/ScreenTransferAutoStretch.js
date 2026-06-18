// BatchSTFStretch
// Installed as ScreenTransferAutoStretch.js for beta update compatibility.
//
// PixInsight JavaScript Runtime script.
//
// Copyright (c) 2026 Ian Steane. All rights reserved.
// Public visibility is for PixInsight update distribution only. No permission
// is granted to copy, modify, redistribute, repackage, sell, sublicense, or
// create derivative works without prior written permission.
//
// Apply or reset an automatic ScreenTransferFunction on selected open images.

#feature-id    BatchSTFStretch : Chapel Astro Utilities > BatchSTFStretch
#feature-info  Apply a linked or unlinked automatic screen stretch to selected open images, or reset their screen transfer functions.

var TITLE = "BatchSTFStretch";
var VERSION = "1.0.0-beta2";

var FrameStyle_Box = 1;
var StdButton_Ok = 1;
var StdIcon_Information = 2;
var StdIcon_Error = 4;
var TextAlign_Left = 0x01;
var TextAlign_VertCenter = 0x80;

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
      var m = Math.mtf(
         TARGET_BACKGROUND,
         medianSum/channelCount - c0 );
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
         var invertedM = Math.mtf( c1 - channelMedian, TARGET_BACKGROUND );
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

function applySTF( view, stfValues )
{
   var process = new ScreenTransferFunction;
   process.STF = stfValues;

   if ( !process.executeOn( view ) )
      throw new Error( "ScreenTransferFunction failed on " + view.id + "." );
}

function selectedWindows( tree )
{
   var windows = new Array;

   for ( var i = 0; i < tree.numberOfChildren; ++i )
   {
      var node = tree.child( i );
      if ( node != null && node.checked &&
           typeof node.__windowIndex == "number" )
      {
         var allWindows = ImageWindow.windows;
         if ( node.__windowIndex < allWindows.length )
         {
            var window = allWindows[node.__windowIndex];
            if ( window.mainView.id == node.__viewId )
               windows.push( window );
         }
      }
   }

   return windows;
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

function BatchSTFStretchDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var dialog = this;

   this.windowTitle = TITLE + " " + VERSION;
   this.minWidth = 640;

   this.introduction = new Label( this );
   this.introduction.text =
      "Select the open images to receive an automatic screen stretch. " +
      "This changes only the screen display and does not alter image pixels.";
   this.introduction.wordWrapping = true;
   this.introduction.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.selectionTitle = new Label( this );
   this.selectionTitle.text = "Image Selection";
   this.selectionTitle.frameStyle = FrameStyle_Box;
   this.selectionTitle.margin = 4;

   this.imageTree = new TreeBox( this );
   this.imageTree.numberOfColumns = 4;
   this.imageTree.headerVisible = true;
   this.imageTree.setHeaderText( 0, "Image" );
   this.imageTree.setHeaderText( 1, "Type" );
   this.imageTree.setHeaderText( 2, "Dimensions" );
   this.imageTree.setHeaderText( 3, "Window" );
   this.imageTree.rootDecoration = false;
   this.imageTree.alternateRowColor = true;
   this.imageTree.minHeight = 220;

   this.selectAllButton = new PushButton( this );
   this.selectAllButton.text = "Select All";
   this.selectAllButton.onClick = function()
   {
      setAllSelections( dialog.imageTree, true );
   };

   this.selectNoneButton = new PushButton( this );
   this.selectNoneButton.text = "Select None";
   this.selectNoneButton.onClick = function()
   {
      setAllSelections( dialog.imageTree, false );
   };

   this.refreshButton = new PushButton( this );
   this.refreshButton.text = "Refresh";
   this.refreshButton.toolTip = "Refresh the list of open image windows.";
   this.refreshButton.onClick = function()
   {
      fillImageTree( dialog.imageTree );
      dialog.updateStatus();
   };

   this.selectionButtons = new HorizontalSizer;
   this.selectionButtons.spacing = 6;
   this.selectionButtons.add( this.selectAllButton );
   this.selectionButtons.add( this.selectNoneButton );
   this.selectionButtons.addStretch();
   this.selectionButtons.add( this.refreshButton );

   this.stretchTitle = new Label( this );
   this.stretchTitle.text = "Stretch Mode";
   this.stretchTitle.frameStyle = FrameStyle_Box;
   this.stretchTitle.margin = 4;

   this.linkedRadio = new RadioButton( this );
   this.linkedRadio.text = "Linked";
   this.linkedRadio.checked = true;
   this.linkedRadio.toolTip =
      "Use one shared screen stretch for all RGB channels.";

   this.unlinkedRadio = new RadioButton( this );
   this.unlinkedRadio.text = "Unlinked";
   this.unlinkedRadio.toolTip =
      "Calculate a separate screen stretch for each RGB channel.";

   this.modeNote = new Label( this );
   this.modeNote.text =
      "Linked preserves the relative channel balance. Unlinked balances each " +
      "color channel independently. Monochrome images are stretched identically in either mode.";
   this.modeNote.wordWrapping = true;
   this.modeNote.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.modeButtons = new HorizontalSizer;
   this.modeButtons.spacing = 14;
   this.modeButtons.add( this.linkedRadio );
   this.modeButtons.add( this.unlinkedRadio );
   this.modeButtons.addStretch();

   this.statusLabel = new Label( this );
   this.statusLabel.wordWrapping = true;
   this.statusLabel.textAlignment = TextAlign_Left | TextAlign_VertCenter;

   this.updateStatus = function()
   {
      var count = dialog.imageTree.numberOfChildren;
      dialog.statusLabel.text = count == 0 ?
         "No open image windows are available." :
         count.toString() + " open image window(s) available.";
   };

   this.executeForSelection = function( reset )
   {
      try
      {
         var windows = selectedWindows( dialog.imageTree );
         if ( windows.length == 0 )
            throw new Error( "Select at least one image." );

         Console.show();
         Console.writeln( "<end><cbr><br>" + TITLE + " " + VERSION );

         for ( var i = 0; i < windows.length; ++i )
         {
            var view = windows[i].mainView;
            var values = reset ?
               identitySTF() :
               calculateAutoSTF( view, dialog.linkedRadio.checked );

            applySTF( view, values );
            Console.writeln( (reset ? "Reset STF: " : "Applied " +
               (dialog.linkedRadio.checked ? "linked" : "unlinked") +
               " auto STF: ") + view.id );
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

   this.applyButton = new PushButton( this );
   this.applyButton.text = "Apply Auto Stretch";
   this.applyButton.defaultButton = true;
   this.applyButton.onClick = function()
   {
      dialog.executeForSelection( false );
   };

   this.resetButton = new PushButton( this );
   this.resetButton.text = "Reset Screen Transfer";
   this.resetButton.toolTip =
      "Remove the screen stretch from the selected images.";
   this.resetButton.onClick = function()
   {
      dialog.executeForSelection( true );
   };

   this.closeButton = new PushButton( this );
   this.closeButton.text = "Close";
   this.closeButton.onClick = function()
   {
      dialog.cancel();
   };

   this.actionSizer = new HorizontalSizer;
   this.actionSizer.spacing = 8;
   this.actionSizer.add( this.applyButton );
   this.actionSizer.add( this.resetButton );
   this.actionSizer.addStretch();
   this.actionSizer.add( this.closeButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.introduction );
   this.sizer.add( this.selectionTitle );
   this.sizer.add( this.imageTree, 100 );
   this.sizer.add( this.selectionButtons );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.stretchTitle );
   this.sizer.add( this.modeButtons );
   this.sizer.add( this.modeNote );
   this.sizer.addSpacing( 4 );
   this.sizer.add( this.statusLabel );
   this.sizer.add( this.actionSizer );

   fillImageTree( this.imageTree );
   this.updateStatus();
   this.adjustToContents();
}
BatchSTFStretchDialog.prototype = new Dialog;

function main()
{
   if ( ImageWindow.windows.length == 0 )
   {
      (new MessageBox( "Open at least one image before running this utility.",
                       TITLE, StdIcon_Information, StdButton_Ok )).execute();
      return;
   }

   var dialog = new BatchSTFStretchDialog;
   dialog.execute();
}

main();
