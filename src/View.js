Ext.define('GraphicDesigner.View', {
	extend : 'Ext.Component',
	xtype : 'gdabstractview',
	requires : ['GraphicDesigner.CanvasPanel'],
	resizable : true,
	draggable : true,
	shapes : [],
	//after instanced, readonly!
	minW : 20,
	minH : 20,
	frame : null,
	text : '',
	resizeDelegate : {xtype : 'gdresizedelegate'},
	dragDelegate : {xtype : 'gddragdelegate'},
	linkDelegate : {xtype : 'gdlinkdelegate'},
	rotateDelegate : {xtype : 'gdrotatedelegate'},
	labelDelegate : {xtype : 'gdlabeldelegate'},
	keyDelegate : {xtype : 'gdkeydelegate'},
	dockDelegate : {xtype : 'gddockdelegate'},
	frameTipDelegate : {xtype : 'gdframetipdelegate'},
	contextmenuDelegate : {xtype : 'gdcontextmenudelegate'},
	inspectorDelegate : {xtype : 'gdinspectordelegate'},
	//other named like xxxDelegate will also b treated as a delegate,if succeeded newed.
	getCustomDescription : Ext.emptyFn,
	restoreCustomDescription : Ext.emptyFn,
	//private
	updateStyle : function() {
		this.set.attr({
			fill : this.style.fill,
			'fill-opacity' : this.style.fillOpacity,
			opacity : this.style.opacity,
			'stroke-width' : this.style.lineWidth,
			stroke : this.style.lineColor,
			'stroke-dasharray' : this.style.lineStyle
		});
	},
	//end private
	getFrame : function() {
		if (this.frame) return this.frame;

		return this.getDefaultFrame();
	},
	getDefaultFrame : function() {
		return {
			x : 50,
			y : 50,
			width : 50,
			height : 50
		};
	},
	getPreview : function(frame) {
		return [{
			type : 'text',
			stroke : 'black',
			'stroke-width' : 1,
			y : frame.y + frame.height / 2,
			text : 'RAW VIEW'
		}];
	},
	//implement this,but never use it!
	//protected
	redraw : Ext.emptyFn,
	layoutInRect : function(rect) {
		//round all!
		rect.x = Math.round(rect.x);
		rect.y = Math.round(rect.y);
		rect.width = Math.round(rect.width);
		rect.height = Math.round(rect.height);

		var ct = this.ownerCt;
		if (ct.constraint) {
			if (rect.x < ct.constraintPadding) {
				rect.x = ct.constraintPadding;
			}
			if (rect.y < ct.constraintPadding) {
				rect.y = ct.constraintPadding;
			}
			if (rect.x > ct.paperWidth - ct.constraintPadding - rect.width) {
				rect.x = ct.paperWidth - ct.constraintPadding - rect.width;
			}
			if (rect.y > ct.paperHeight - ct.constraintPadding - rect.height) {
				rect.y = ct.paperHeight - ct.constraintPadding - rect.height;
			}
		}

		rect.width = Math.max(rect.width, this.minW);
		rect.height = Math.max(rect.height, this.minH);

		this.frame = rect;
		this.redraw();
		this.fireEvent('layout', rect);
	},
	buildUI : function(paper) {
		this.set = paper.add(this.shapes);

		this.style = Ext.apply({
			opacity : 1,
			fill : '#ffffff',
			fillOpacity : 1,
			lineColor : '#000000',
			lineWidth : 2,
			lineStyle : ''
		}, this.style);

		this.updateStyle();
		this.afterViewBuilt();

		this.afterRender();
	},
	pre : function() {
		var ct = this.ownerCt;
		return ct.views[ct.views.indexOf(this) - 1];
	},
	next : function() {
		var ct = this.ownerCt;
		return ct.views[ct.views.indexOf(this) + 1];
	},
	flipToFront : function() {
		var ct = this.ownerCt;
		var idx = ct.views.indexOf(this);
		if (idx == -1 || idx == ct.views.length - 1) return;

		ct.views.gdmove(idx, idx + 1);
		ct.orderViewsZIndex();
	},
	flipToBack : function() {
		var ct = this.ownerCt;
		var idx = ct.views.indexOf(this);
		if (idx == -1 || idx == 0) return;

		ct.views.gdmove(idx, idx - 1);
		ct.orderViewsZIndex();

		this.fireEvent('zindexed');
	},
	flipToTop : function() {
		var ct = this.ownerCt;
		var idx = ct.views.indexOf(this);
		if (idx == -1 || idx == ct.views.length - 1) return;

		ct.views.gdmove(idx, ct.views.length - 1);
		ct.orderViewsZIndex();

		this.fireEvent('zindexed');
	},
	flipToBottom : function() {
		var ct = this.ownerCt;
		var idx = ct.views.indexOf(this);
		if (idx == -1 || idx == 0) return;

		ct.views.gdmove(idx, 0);
		ct.orderViewsZIndex();

		this.fireEvent('zindexed');
	},
	//add custom delegates to this view in the function
	afterViewBuilt : Ext.emptyFn,
	//do not override this!
	getGraphicDescription : function() {
		return Ext.apply({
			typeName : Ext.getClassName(this),
			viewId : this.viewId,
			frame : Ext.clone(this.frame),
			minW : this.minW,
			minH : this.minH,
			text : this.labelDelegate ? this.labelDelegate.text : '',
			linkers : this.linkDelegate ? this.linkDelegate.getLinkersData() : null,
			zIndex : this.zIndex,
			style : this.style,
			labelStyle : this.labelDelegate ? this.labelDelegate.style : null
		}, this.getCustomDescription());
	},
	afterRender : function() {
		this._innerDlgts = [];
		var me = this;

		this.layoutInRect(this.getFrame());

		//translate click&dblclick event!
		var clicked = false;
		var dblclicked = false;
		this.on('dragstart', function(x, y, e) {
			e.stopPropagation();
			if (clicked) {
				clicked = false;
				dblclicked = true;
				me.fireEvent('dblclick');
			} else {
				clicked = true;//record 1 click,if no more click,it will dicard it!
				setTimeout(function() {
					if (!dblclicked) me.fireEvent('click');
					clicked = false;
					dblclicked = false;
				}, 400);
			}
		});

		this.set.drag(function(dx, dy, x, y, e) {
			me.frame = me.set.getBBox();
			me.fireEvent('dragmoving', dx, dy, x, y, e);
		}, function(x, y ,e) {
			if (e.button == 2) {
				me.ownerCt.fireEvent('viewclicked', me);
				me.fireEvent('contextmenu', x, y, e);
				return;
			}
			me.fireEvent('dragstart', x, y, e);
			me.ownerCt.fireEvent('viewclicked', me);
		}, function(e) {
			me.fireEvent('dragend', e);
		});
		this.set.click(function(e) {
			e.stopPropagation();
		});

		this.set.hover(function() {
			me.fireEvent('hover');
		}, function() {
			me.fireEvent('unhover');
		});
		//===========end translating===============

		if (this.dragDelegate) {
			if (!this.dragDelegate.xtype) this.dragDelegate.xtype = 'gddragdelegate';
			this.dragDelegate = Ext.widget(this.dragDelegate);
			this.dragDelegate.wireView(this);
		}
		if (!this.labelDelegate) {
			this.labelDelegate = {
				xtype : 'gdlabeldelegate',
				editable : false
			};
		}
		if (!this.labelDelegate.xtype) this.labelDelegate.xtype = 'gdlabeldelegate';
		this.labelDelegate = Ext.widget(this.labelDelegate);
		this.labelDelegate.wireView(this);

		if (this.rotateDelegate) {
			if (!this.rotateDelegate.xtype) this.rotateDelegate.xtype = 'gdrotatedelegate';
			this.rotateDelegate = Ext.widget(this.rotateDelegate);
			this.rotateDelegate.wireView(this);
		}
		if (this.resizeDelegate) {
			if (!this.resizeDelegate.xtype) this.resizeDelegate.xtype = 'gdresizedelegate';
			this.resizeDelegate = Ext.widget(this.resizeDelegate);
			this.resizeDelegate.wireView(this);
		}
		if (this.linkDelegate) {
			if (!this.linkDelegate.xtype) this.linkDelegate.xtype = 'gdlinkdelegate';
			this.linkDelegate = Ext.widget(this.linkDelegate);
			this.linkDelegate.wireView(this);
		}
		if (this.keyDelegate) {
			if (!this.keyDelegate.xtype) this.keyDelegate.xtype = 'gdkeydelegate';
			this.keyDelegate = Ext.widget(this.keyDelegate);
			this.keyDelegate.wireView(this);
		}
		if (this.dockDelegate) {
			if (!this.dockDelegate.xtype) this.dockDelegate.xtype = 'gddockdelegate';
			this.dockDelegate = Ext.widget(this.dockDelegate);
			this.dockDelegate.wireView(this);
		}
		if (this.frameTipDelegate) {
			if (!this.frameTipDelegate.xtype) this.frameTipDelegate.xtype = 'gdframetipdelegate';
			this.frameTipDelegate = Ext.widget(this.frameTipDelegate);
			this.frameTipDelegate.wireView(this);
		}
		if (this.contextmenuDelegate) {
			if (!this.contextmenuDelegate.xtype) this.contextmenuDelegate.xtype = 'gdcontextmenudelegate';
			this.contextmenuDelegate = Ext.widget(this.contextmenuDelegate);
			this.contextmenuDelegate.wireView(this);
		}
		if (this.inspectorDelegate) {
			if (!this.inspectorDelegate.xtype) this.inspectorDelegate.xtype = 'gdinspectordelegate';
			this.inspectorDelegate = Ext.widget(this.inspectorDelegate);
			this.inspectorDelegate.wireView(this);
		}

		//auto-detect xxxxDelegate
		for (var key in this) {
			if (!key.endsWith('Delegate')) continue;

			var v = this[key];
			if (v == null || v.rendered) continue;

			try {
				if (Ext.isObject(v) && !v.xtype) v.xtype = 'gdviewdelegate';
				var dlgt = Ext.widget(v);
				dlgt.wireView(this);
				this[key] = dlgt;
				this._innerDlgts.push(dlgt);
			} catch(e) {}
		}

		this.rendered = true;
		this.fireEvent('afterRender');
	},
	//private
	afterRestoreByDescription : function(canvasPanel) {
		//restore linkers
		var linkers = this.linkers;
		delete this.linkers;
		if (!Ext.isEmpty(linkers) && this.linkDelegate) {
			this.linkDelegate.restoreLinkers(linkers);
		}

		this.restoreCustomDescription();
	},
	//public
	setDisabled : function(disabled) {
		this.disabled = disabled;

		if (disabled) {
			this.labelDelegate ? this.labelDelegate.disableListeners() : null;
			this.rotateDelegate ? this.rotateDelegate.disableListeners() : null;
			this.dragDelegate ? this.dragDelegate.disableListeners() : null;
			this.resizeDelegate ? this.resizeDelegate.disableListeners() : null;
			this.linkDelegate ? this.linkDelegate.disableListeners() : null;
			this.keyDelegate ? this.keyDelegate.disableListeners() : null;
			this.dockDelegates ? this.dockDelegates.disableListeners() : null;
			this.frameTipDelegate ? this.dockDelegates.disableListeners() : null;
			this.contextmenuDelegate ? this.contextmenuDelegate.disableListeners() : null;
			this.inspectorDelegate ? this.inspectorDelegate.disableListeners() : null;
			this._innerDlgts.filter(function(d) {d.disableListeners();});
		} else {
			this.labelDelegate ? this.labelDelegate.enableListeners() : null;
			this.rotateDelegate ? this.rotateDelegate.enableListeners() : null;
			this.dragDelegate ? this.dragDelegate.enableListeners() : null;
			this.resizeDelegate ? this.resizeDelegate.enableListeners() : null;
			this.linkDelegate ? this.linkDelegate.enableListeners() : null;
			this.keyDelegate ? this.keyDelegate.enableListeners() : null;
			this.dockDelegates ? this.dockDelegates.enableListeners() : null;
			this.frameTipDelegate ? this.dockDelegates.enableListeners() : null;
			this.contextmenuDelegate ? this.contextmenuDelegate.enableListeners() : null;
			this.inspectorDelegate ? this.inspectorDelegate.enableListeners() : null;
			this._innerDlgts.filter(function(d) {d.enableListeners();});
		}
	},
	//private
	destroy : function() {
		if (this.selected) {
			this.fireEvent('deselected');
		}
		this.labelDelegate ? this.labelDelegate.destroy() : null;
		this.rotateDelegate ? this.rotateDelegate.destroy() : null;
		this.dragDelegate ? this.dragDelegate.destroy() : null;
		this.resizeDelegate ? this.resizeDelegate.destroy() : null;
		this.linkDelegate ? this.linkDelegate.destroy() : null;
		this.keyDelegate ? this.keyDelegate.destroy() : null;
		this.dockDelegates ? this.dockDelegates.destroy() : null;
		this.contextmenuDelegate ? this.contextmenuDelegate.destroy() : null;
		this.inspectorDelegate ? this.inspectorDelegate.destroy() : null;
		Ext.each(this._innerDlgts, function(d) {d.destroy();});

		this.set.remove();

		this.ownerCt ? this.ownerCt.removeView(this) : null;
		this.inspectorDelegate ? this.inspectorDelegate.bbEvent('destroy', []) : null;

		this.destroyed = true;
		if (this.selected) {
			this.ownerCt.selModel ? this.ownerCt.selModel.fireEvent('selectionchange') : null;
		}
	}
});