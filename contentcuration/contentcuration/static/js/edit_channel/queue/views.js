var Backbone = require("backbone");
var _ = require("underscore");
require("queue.less");
var BaseViews = require("./../views");
var Models = require("./../models");
var DragHelper = require("edit_channel/utils/drag_drop");
var PreviewerViews = require("edit_channel/previewer/views");

/* Loaded when user clicks clipboard button below navigation bar */
var Queue = BaseViews.BaseView.extend({
	template: require("./hbtemplates/queue.handlebars"),
	item_view:"queue",
	initialize: function(options) {
		_.bindAll(this, 'toggle_queue', 'switch_to_queue', 'switch_to_trash');	
		this.render();
		this.$el.find("#queue").css("margin-right", -this.$el.find("#main-queue").outerWidth());
		this.clipboard_queue = new QueueList({
			collection: this.collection,
			model: window.current_channel.get_tree("clipboard").get_root(),
			el: this.$el.find("#clipboard-queue"),
			is_clipboard: true,
			add_controls : true,
			indent:0,
			container: this
		});
		this.trash_queue = new QueueList({
			collection: this.collection,
			model : window.current_channel.get_tree("deleted").get_root(),
			el: this.$el.find("#trash-queue"),
			is_clipboard : false,
			add_controls : true,
			indent:0,
			container: this
		});
		this.switch_tab("clipboard");
	},
	render: function() {
		this.$el.html(this.template({}));
	},
	events: {
		'click .queue-button' : 'toggle_queue',
		'click .switch_to_queue' : 'switch_to_queue',
		'click .switch_to_trash' : 'switch_to_trash'
	},
	toggle_queue: function(){
		if(this.$el.find("#queue").css("margin-right") != "0px")
			this.$el.find("#queue").animate({marginRight:0}, 500);
		else
			this.$el.find("#queue").animate({marginRight: -this.$el.find("#main-queue").outerWidth()}, 500);
	},
	add_to_clipboard:function(models){
		var self = this;
		models.forEach(function(entry){
			self.collection.add(entry);
		});
		this.render();
	},
	switch_to_queue:function(){
		this.switch_tab("clipboard");	
	},
	switch_to_trash:function(){
		this.switch_tab("trash");
	},
	switch_tab:function(tabname){
		this.$el.find((tabname == "trash")? "#trash-queue" : "#clipboard-queue").css("display", "block");
		this.$el.find((tabname == "trash")? "#clipboard-queue" : "#trash-queue").css("display", "none");
		this.$el.find((tabname == "trash")? ".switch_to_trash" : ".switch_to_queue" ).addClass("active-queue-tab");
		this.$el.find((tabname == "trash")? ".switch_to_queue" : ".switch_to_trash" ).removeClass("active-queue-tab");
	}
});


var QueueList = BaseViews.BaseListView.extend({
	template: require("./hbtemplates/queue_list.handlebars"),
	item_view:"queue",
	initialize: function(options) {
		this.is_clipboard = options.is_clipboard;
		this.collection = options.collection.get_all_fetch(this.model.get("children"));
		this.collection.sort_by_order();
		this.set_sort_orders(this.collection);
		this.add_controls = options.add_controls;
		this.container = options.container;
		this.indent = options.indent;
		_.bindAll(this, 'check_all', 'delete_items', 'edit_items', 'add_items', 'move_trash');
		this.render();
		this.listenTo(this.model, "change:children", this.prerender);
	},
	events: {
		'click #select_all_check' : 'check_all',
		'click .delete_items' : 'delete_items',
		'click .edit_items' : 'edit_items',
		'click .add_items' : 'add_items',
		'click .move_trash' : 'move_trash'
	},
	prerender:function(){
		console.log("CALLING PRERENDER FOR " + ((this.is_clipboard)? "CLIPBOARD" : "TRASH"));
		this.render();
	},
	render: function() {
		DragHelper.removeDragDrop(this);
		console.log("RENDERING " + ((this.is_clipboard)? "clipboard" : "trash"));
		this.collection = this.collection.get_all_fetch(this.model.get("children"));
		this.collection.sort_by_order();
		this.$el.html(this.template({
			content_list : this.collection.toJSON(),
			is_clipboard : this.is_clipboard,
			add_controls : this.add_controls
		}));

		this.load_content();
		console.log("views", this.views);
		$((this.is_clipboard)? ".queue-badge" : ".trash-badge").html(this.views.length);
		this.$el.data("container", this);
		this.$el.find("ul").data("list", this);
		this.$el.find(".default-item").data("data", {
			containing_list_view: this, 
			index:0
		});
		DragHelper.addDragDrop(this);
	},
	load_content:function(){
		console.log("Starting load content");
		this.views = [];
		this.collection.sort_by_order();
		var self = this;
		this.list_index = 0;
		this.collection.forEach(function(entry){
			var item_view = new QueueItem({
				containing_list_view: self,
				model: entry,
				indent : self.indent,
				index : self.list_index ++,
				is_clipboard : self.is_clipboard
			});
			self.$el.find("ul").append(item_view.el);
			self.views.push(item_view);
		});
		console.log("ending load content");
	},
	check_all :function(){
		this.$el.find("input[type=checkbox]").attr("checked", this.$el.find("#select_all_check").is(":checked"));
	},
	delete_items:function(){
		if(this.is_clipboard)
			this.delete_selected();
		else{
			this.views.forEach(function (entry){
				entry.remove_item();
			});
		}
		//this.container.trash_queue.render();
	},
	edit_items:function(){
		this.edit_selected();
	},
	add_items:function(){
		this.add_to_view();
	},
	move_trash:function(){
		var list = this.$el.find('input:checked').parent("li");
		if(list.length == 0){
			alert("No items selected.");
		}else{
			var parent = window.current_channel.get_tree("clipboard");
			for(var i =0 ;i < list.length; i++){
				var model = $("#" + list[i].id).data("data").model;
				model.set({parent:  parent.get("root_node")}, {validate:true});
				while(model.validationError){
					model.set({title: model.generate_title()}, {validate:true});
				}
				model.save();
				parent.set({children: parent.get("children").push(model)});
			}
			parent.save({validate:false});

			model.set({parent:  window.current_channel.get_tree("clipboard").get("root_node")}, {validate:true});
			this.render();
			//this.container.clipboard_queue.render();
		}
	}
	
});

/* Loaded when user clicks clipboard button below navigation bar */
var QueueItem = BaseViews.BaseListItemView.extend({
	template: require("./hbtemplates/queue_item.handlebars"),
	tagName: "li", 
	indent: 0,
	'id': function() {
		return "queue_item_" + this.model.get("id"); 
	},
	initialize: function(options) {
		_.bindAll(this, 'remove_item', 'toggle','edit_item', 'submit_item');
		console.log("loading", this.model);
		this.containing_list_view = options.containing_list_view;
		this.allow_edit = false;
		this.indent = options.indent + 20;
		this.is_clipboard = options.is_clipboard;
		this.index = options.index;
		this.render();
	},
	events: {
		'click .delete_content' : 'remove_item',
		'click .tog_folder' : 'toggle',
		'click .edit_content' : 'edit_item',
		'click .submit_content' : "submit_item",
		'keydown .clipboard_title_input' : "submit_item",
		'dblclick .clipboard_item_title' : 'edit_item'
	},
	render: function() {
		this.$el.html(this.template({
			node:this.model,
			isfolder: this.model.get("kind").toLowerCase() == "topic",
			allow_edit: this.allow_edit,
			sub_list: this.model.get("children"),
			indent: this.indent,
			is_clipboard : this.is_clipboard,
			index: this.index
		}));
		this.$el.data("data", this);
	},
	toggle:function(){
		event.stopPropagation();
		event.preventDefault();
		this.load_subfiles();
		var el =  this.$el.find("#menu_toggle_" + this.model.id);
		if(el.hasClass("glyphicon-menu-up")){
			this.$el.find("#" + this.id() +"_sub").slideDown();
			el.removeClass("glyphicon-menu-up").addClass("glyphicon-menu-down");
		}else{
			this.$el.find("#" + this.id() +"_sub").slideUp();
			el.removeClass("glyphicon-menu-down").addClass("glyphicon-menu-up");
		}
	},
	load_subfiles:function(){
		this.subfile_view = new QueueList({
			collection: this.containing_list_view.collection,
			el: this.$el.find("#" + this.id() +"_sub"),
			is_clipboard : this.is_clipboard,
			add_controls : false,
			model: this.model
		});
	},
	remove_item: function(){
		if(confirm("Are you sure you want to delete " + this.model.get("title") + "?")){
			console.log("is clipboard? ",this.is_clipboard);
			if(this.is_clipboard){
				this.delete();
			//	this.containing_list_view.container.trash_queue.render();
			}else{
				console.log("deleting permanently", this.model);
				this.delete_view();
				this.model.destroy();
			}
		}
	},
	edit_item: function(){
		console.log("editing item...");
		this.allow_edit = true;
		this.render();
	},
	submit_item:function(event){
		if(!event.keyCode || event.keyCode ==13){
			this.model.set({title: this.$el.find(".queue_title_input").val().trim()}, {validate:true});
			if(this.model.validationError){
				this.$el.find(".node_title_textbox").addClass("error_input");
				this.$el.find(".error_msg").html(this.model.validationError);
			}
			else{
				this.save();
				this.allow_edit = false;
				this.render();
			}
		}
	}
});

module.exports = {
	Queue:Queue
}