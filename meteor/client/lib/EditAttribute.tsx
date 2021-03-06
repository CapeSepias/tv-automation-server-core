import * as React from 'react'
import * as _ from 'underscore'
import { withTracker } from './ReactMeteorData/react-meteor-data'
import { faCheckSquare, faSquare } from '@fortawesome/free-solid-svg-icons'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { Mongo } from 'meteor/mongo'

import { MultiSelect, MultiSelectEvent } from './multiSelect'
import { TransformedCollection } from '../../lib/typings/meteor'
import ClassNames from 'classnames'
import { ColorPickerEvent, ColorPicker } from './colorPicker'
import { IconPicker, IconPickerEvent } from './iconPicker'
import { Random } from 'meteor/random'

interface IEditAttribute extends IEditAttributeBaseProps {
	type: EditAttributeType
}
export type EditAttributeType =
	| 'text'
	| 'multiline'
	| 'int'
	| 'float'
	| 'checkbox'
	| 'dropdown'
	| 'dropdowntext'
	| 'switch'
	| 'multiselect'
	| 'json'
	| 'colorpicker'
	| 'iconpicker'
export class EditAttribute extends React.Component<IEditAttribute> {
	render() {
		if (this.props.type === 'text') {
			return <EditAttributeText {...this.props} />
		} else if (this.props.type === 'multiline') {
			return <EditAttributeMultilineText {...this.props} />
		} else if (this.props.type === 'int') {
			return <EditAttributeInt {...this.props} />
		} else if (this.props.type === 'float') {
			return <EditAttributeFloat {...this.props} />
		} else if (this.props.type === 'checkbox') {
			return <EditAttributeCheckbox {...this.props} />
		} else if (this.props.type === 'switch') {
			return <EditAttributeSwitch {...this.props} />
		} else if (this.props.type === 'dropdown') {
			return <EditAttributeDropdown {...this.props} />
		} else if (this.props.type === 'dropdowntext') {
			return <EditAttributeDropdownText {...this.props} />
		} else if (this.props.type === 'multiselect') {
			return <EditAttributeMultiSelect {...this.props} />
		} else if (this.props.type === 'json') {
			return <EditAttributeJson {...this.props} />
		} else if (this.props.type === 'colorpicker') {
			return <EditAttributeColorPicker {...this.props} />
		} else if (this.props.type === 'iconpicker') {
			return <EditAttributeIconPicker {...this.props} />
		}

		return <div>Unknown edit type {this.props.type}</div>
	}
}

interface IEditAttributeBaseProps {
	updateOnKey?: boolean
	attribute?: string
	collection?: TransformedCollection<any, any>
	myObject?: any
	obj?: any
	options?: any
	optionsAreNumbers?: boolean
	className?: string
	modifiedClassName?: string
	invalidClassName?: string
	updateFunction?: (edit: EditAttributeBase, newValue: any) => void
	overrideDisplayValue?: any
	label?: string
	mutateDisplayValue?: (v: any) => any
	mutateUpdateValue?: (v: any) => any
	disabled?: boolean
}
interface IEditAttributeBaseState {
	value: any
	valueError: boolean
	editing: boolean
}
export class EditAttributeBase extends React.Component<IEditAttributeBaseProps, IEditAttributeBaseState> {
	constructor(props) {
		super(props)

		this.state = {
			value: this.getAttribute(),
			valueError: false,
			editing: false,
		}

		this.handleEdit = this.handleEdit.bind(this)
		this.handleUpdate = this.handleUpdate.bind(this)
		this.handleDiscard = this.handleDiscard.bind(this)
	}
	handleEdit(newValue) {
		this.setState({
			value: newValue,
			editing: true,
		})
		if (this.props.updateOnKey) {
			this.updateValue(newValue)
		}
	}
	handleUpdate(newValue) {
		this.handleUpdateButDontSave(newValue)
		this.updateValue(newValue)
	}
	handleUpdateEditing(newValue) {
		this.handleUpdateButDontSave(newValue, true)
		this.updateValue(newValue)
	}
	handleUpdateButDontSave(newValue, editing = false) {
		this.setState({
			value: newValue,
			editing,
		})
	}
	handleDiscard() {
		this.setState({
			value: this.getAttribute(),
			editing: false,
		})
	}
	deepAttribute(obj, attr): any {
		// Returns a value deep inside an object
		// Example: deepAttribute(company,"ceo.address.street");

		const f = (obj, attr) => {
			if (obj) {
				let attributes = attr.split('.')

				if (attributes.length > 1) {
					let outerAttr = attributes.shift()
					let innerAttrs = attributes.join('.')

					return f(obj[outerAttr], innerAttrs)
				} else {
					return obj[attributes[0]]
				}
			} else {
				return obj
			}
		}
		return f(obj, attr || '')
	}
	getAttribute() {
		let v = null
		if (this.props.overrideDisplayValue) {
			v = this.props.overrideDisplayValue
		} else {
			v = this.deepAttribute(this.props.myObject, this.props.attribute)
		}
		return this.props.mutateDisplayValue ? this.props.mutateDisplayValue(v) : v
	}
	getAttributeText() {
		return this.getAttribute() + ''
	}
	getEditAttribute() {
		return this.state.editing ? this.state.value : this.getAttribute()
	}
	updateValue(newValue) {
		if (this.props.mutateUpdateValue) {
			try {
				newValue = this.props.mutateUpdateValue(newValue)
				this.setState({
					valueError: false,
				})
			} catch (e) {
				this.setState({
					valueError: true,
					editing: true,
				})
				return
			}
		}

		if (this.props.updateFunction && typeof this.props.updateFunction === 'function') {
			this.props.updateFunction(this, newValue)
		} else {
			if (this.props.collection && this.props.attribute) {
				if (newValue === undefined) {
					let m = {}
					m[this.props.attribute] = 1
					this.props.collection.update(this.props.obj._id, { $unset: m })
				} else {
					let m = {}
					m[this.props.attribute] = newValue
					this.props.collection.update(this.props.obj._id, { $set: m })
				}
			}
		}
	}
}
function wrapEditAttribute(newClass) {
	return withTracker((props: IEditAttributeBaseProps) => {
		// These properties will be exposed under this.props
		// Note that these properties are reactively recalculated
		return {
			myObject: props.collection ? props.collection.findOne(props.obj._id) : props.obj || {},
		}
	})(newClass)
}

const EditAttributeText = wrapEditAttribute(
	class EditAttributeText extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
			this.handleBlur = this.handleBlur.bind(this)
			this.handleEscape = this.handleEscape.bind(this)
		}
		handleChange(event) {
			this.handleEdit(event.target.value)
		}
		handleBlur(event) {
			this.handleUpdate(event.target.value)
		}
		handleEscape(event) {
			let e = event as KeyboardEvent
			if (e.key === 'Escape') {
				this.handleDiscard()
			}
		}
		render() {
			return (
				<input
					type="text"
					className={
						'form-control' +
						' ' +
						(this.state.valueError ? 'error ' : '') +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '')
					}
					placeholder={this.props.label}
					value={this.getEditAttribute() || ''}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					onKeyUp={this.handleEscape}
					disabled={this.props.disabled}
				/>
			)
		}
	}
)
const EditAttributeMultilineText = wrapEditAttribute(
	class EditAttributeMultilineText extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
			this.handleBlur = this.handleBlur.bind(this)
			this.handleEscape = this.handleEscape.bind(this)
		}
		handleChange(event) {
			this.handleEdit(event.target.value)
		}
		handleBlur(event) {
			this.handleUpdate(event.target.value)
		}
		handleEscape(event) {
			let e = event as KeyboardEvent
			if (e.key === 'Escape') {
				this.handleDiscard()
			}
		}
		handleEnterKey(event) {
			let e = event as KeyboardEvent
			if (e.key === 'Enter') {
				e.stopPropagation()
			}
		}
		render() {
			return (
				<textarea
					className={
						'form-control' +
						' ' +
						(this.state.valueError ? 'error ' : '') +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '')
					}
					placeholder={this.props.label}
					value={this.getEditAttribute() || ''}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					onKeyUp={this.handleEscape}
					onKeyPress={this.handleEnterKey}
					disabled={this.props.disabled}
				/>
			)
		}
	}
)
const EditAttributeInt = wrapEditAttribute(
	class EditAttributeInt extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
			this.handleBlur = this.handleBlur.bind(this)
		}
		getValue(event) {
			return parseInt(event.target.value, 10)
		}
		handleChange(event) {
			// this.handleEdit(this.getValue(event))
			let v = this.getValue(event)
			_.isNaN(v) ? this.handleUpdateButDontSave(v, true) : this.handleUpdateEditing(v)
		}
		handleBlur(event) {
			let v = this.getValue(event)
			_.isNaN(v) ? this.handleDiscard() : this.handleUpdate(v)
		}
		getEditAttributeNumber() {
			let val = this.getEditAttribute()
			if (_.isNaN(val)) val = ''
			return val
		}
		render() {
			return (
				<input
					type="number"
					step="1"
					className={
						'form-control' +
						' ' +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '')
					}
					placeholder={this.props.label}
					value={this.getEditAttributeNumber()}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					disabled={this.props.disabled}
				/>
			)
		}
	}
)
const EditAttributeFloat = wrapEditAttribute(
	class EditAttributeFloat extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
			this.handleBlur = this.handleBlur.bind(this)
		}
		getValue(event) {
			return parseFloat(event.target.value.replace(',', '.'))
		}
		handleChange(event) {
			// this.handleEdit(this.getValue(event))
			let v = this.getValue(event)
			_.isNaN(v) ? this.handleUpdateButDontSave(v, true) : this.handleUpdateEditing(v)
		}
		handleBlur(event) {
			let v = this.getValue(event)
			_.isNaN(v) ? this.handleDiscard() : this.handleUpdate(v)
		}
		getEditAttributeNumber() {
			let val = this.getEditAttribute()
			if (_.isNaN(val)) val = ''
			return val
		}
		render() {
			return (
				<input
					type="number"
					step="0.1"
					className={
						'form-control' +
						' ' +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '')
					}
					placeholder={this.props.label}
					value={this.getEditAttributeNumber()}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					disabled={this.props.disabled}
				/>
			)
		}
	}
)
const EditAttributeCheckbox = wrapEditAttribute(
	class EditAttributeCheckbox extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		isChecked() {
			return !!this.getEditAttribute()
		}
		handleChange(event) {
			this.handleUpdate(!this.state.value)
		}
		render() {
			return (
				<label>
					<span
						className={
							'checkbox' +
							' ' +
							(this.props.className || '') +
							' ' +
							(this.state.editing ? this.props.modifiedClassName || '' : '')
						}>
						<input
							type="checkbox"
							className="form-control"
							checked={this.isChecked()}
							onChange={this.handleChange}
							disabled={this.props.disabled}
						/>
						<span className="checkbox-checked">
							<FontAwesomeIcon icon={faCheckSquare} />
						</span>
						<span className="checkbox-unchecked">
							<FontAwesomeIcon icon={faSquare} />
						</span>
					</span>
				</label>
			)
		}
	}
)

const EditAttributeSwitch = wrapEditAttribute(
	class EditAttributeSwitch extends EditAttributeBase {
		constructor(props) {
			super(props)
		}
		isChecked() {
			return !!this.getEditAttribute()
		}
		handleChange = (event) => {
			this.handleUpdate(!this.state.value)
		}
		handleClick = (event) => {
			this.handleChange(event)
		}
		render() {
			return (
				<div
					className={
						'switch ' +
						' ' +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '') +
						' ' +
						(this.isChecked() ? 'switch-active' : '') +
						' ' +
						(this.props.disabled ? 'disabled' : '')
					}
					onClick={this.handleClick}>
					{this.props.label}
				</div>
			)
		}
	}
)
const EditAttributeDropdown = wrapEditAttribute(
	class EditAttributeDropdown extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event) {
			// because event.target.value is always a string, use the original value instead
			let option = _.find(this.getOptions(), (o) => {
				return o.value + '' === event.target.value + ''
			})

			let value = option ? option.value : event.target.value

			this.handleUpdate(this.props.optionsAreNumbers ? parseInt(value, 10) : value)
		}
		getOptions(addOptionForCurrentValue?: boolean) {
			let options: Array<{ value: any; name: string; i?: number }> = []

			if (Array.isArray(this.props.options)) {
				// is it an enum?
				for (let key in this.props.options) {
					let val = this.props.options[key]
					if (typeof val === 'object') {
						options.push({
							name: val.name,
							value: val.value,
						})
					} else {
						options.push({
							name: val,
							value: val,
						})
					}
				}
			} else if (typeof this.props.options === 'object') {
				// Is options an enum?
				let keys = Object.keys(this.props.options)
				let first = this.props.options[keys[0]]
				if (this.props.options[first] + '' === keys[0] + '') {
					// is an enum, only pick
					for (let key in this.props.options) {
						if (!_.isNaN(parseInt(key, 10))) {
							// key is a number (the key)
							let enumValue = this.props.options[key]
							let enumKey = this.props.options[enumValue]
							options.push({
								name: enumValue,
								value: enumKey,
							})
						}
					}
				} else {
					for (let key in this.props.options) {
						let val = this.props.options[key]
						if (Array.isArray(val)) {
							options.push({
								name: key,
								value: val,
							})
						} else {
							options.push({
								name: key + ': ' + val,
								value: val,
							})
						}
					}
				}
			}

			if (addOptionForCurrentValue) {
				let currentValue = this.getAttribute()
				let currentOption = _.find(options, (o) => {
					if (Array.isArray(o.value)) {
						return _.contains(o.value, currentValue)
					}
					return o.value === currentValue
				})
				if (!currentOption) {
					// if currentOption not found, then add it to the list:
					options.push({
						name: 'Value: ' + currentValue,
						value: currentValue,
					})
				}
			}

			for (let i = 0; i < options.length; i++) {
				options[i].i = i
			}

			return options
		}
		render() {
			return (
				<select
					className={
						'form-control' +
						' ' +
						(this.props.className || '') +
						' ' +
						(this.state.editing ? this.props.modifiedClassName || '' : '')
					}
					value={this.getAttributeText()}
					onChange={this.handleChange}
					disabled={this.props.disabled}>
					{this.getOptions(true).map((o, j) =>
						Array.isArray(o.value) ? (
							<optgroup key={j} label={o.name}>
								{o.value.map((v, i) => (
									<option key={i} value={v + ''}>
										{v}
									</option>
								))}
							</optgroup>
						) : (
							<option key={o.i} value={o.value + ''}>
								{o.name}
							</option>
						)
					)}
				</select>
			)
		}
	}
)
const EditAttributeDropdownText = wrapEditAttribute(
	class EditAttributeDropdownText extends EditAttributeBase {
		private _id: string

		constructor(props) {
			super(props)

			this.handleChangeDropdown = this.handleChangeDropdown.bind(this)
			this.handleChangeText = this.handleChangeText.bind(this)
			this.handleBlurText = this.handleBlurText.bind(this)
			this.handleEscape = this.handleEscape.bind(this)

			this._id = Random.id()
		}
		handleChangeDropdown(event) {
			// because event.target.value is always a string, use the original value instead
			let option = _.find(this.getOptions(), (o) => {
				return o.value + '' === event.target.value + ''
			})

			let value = option ? option.value : event.target.value

			this.handleUpdate(this.props.optionsAreNumbers ? parseInt(value, 10) : value)
		}
		handleChangeText(event) {
			this.handleChangeDropdown(event)
		}
		handleBlurText(event) {
			this.handleUpdate(event.target.value)
		}
		handleEscape(event) {
			let e = event as KeyboardEvent
			if (e.key === 'Escape') {
				this.handleDiscard()
			}
		}
		getOptions(addOptionForCurrentValue?: boolean) {
			let options: Array<{ value: any; name: string; i?: number }> = []

			if (Array.isArray(this.props.options)) {
				// is it an enum?
				for (let key in this.props.options) {
					let val = this.props.options[key]
					if (typeof val === 'object') {
						options.push({
							name: val.name,
							value: val.value,
						})
					} else {
						options.push({
							name: val,
							value: val,
						})
					}
				}
			} else if (typeof this.props.options === 'object') {
				// Is options an enum?
				let keys = Object.keys(this.props.options)
				let first = this.props.options[keys[0]]
				if (this.props.options[first] + '' === keys[0] + '') {
					// is an enum, only pick
					for (let key in this.props.options) {
						if (!_.isNaN(parseInt(key, 10))) {
							// key is a number (the key)
							let enumValue = this.props.options[key]
							let enumKey = this.props.options[enumValue]
							options.push({
								name: enumValue,
								value: enumKey,
							})
						}
					}
				} else {
					for (let key in this.props.options) {
						let val = this.props.options[key]
						if (Array.isArray(val)) {
							options.push({
								name: key,
								value: val,
							})
						} else {
							options.push({
								name: key + ': ' + val,
								value: val,
							})
						}
					}
				}
			}

			if (addOptionForCurrentValue) {
				let currentValue = this.getAttribute()
				let currentOption = _.find(options, (o) => {
					if (Array.isArray(o.value)) {
						return _.contains(o.value, currentValue)
					}
					return o.value === currentValue
				})
				if (!currentOption) {
					// if currentOption not found, then add it to the list:
					options.push({
						name: 'Value: ' + currentValue,
						value: currentValue,
					})
				}
			}

			for (let i = 0; i < options.length; i++) {
				options[i].i = i
			}

			return options
		}
		render() {
			return (
				<div className="input-dropdowntext">
					<input
						type="text"
						className={
							'form-control' +
							' ' +
							(this.state.valueError ? 'error ' : '') +
							(this.props.className || '') +
							' ' +
							(this.state.editing ? this.props.modifiedClassName || '' : '')
						}
						placeholder={this.props.label}
						value={this.getEditAttribute() || ''}
						onChange={this.handleChangeText}
						onBlur={this.handleBlurText}
						onKeyUp={this.handleEscape}
						disabled={this.props.disabled}
						spellCheck={false}
						list={this._id}
					/>

					<datalist id={this._id}>
						{this.getOptions(true).map((o, j) =>
							Array.isArray(o.value) ? (
								<optgroup key={j} label={o.name}>
									{o.value.map((v, i) => (
										<option key={i} value={v + ''}>
											{v}
										</option>
									))}
								</optgroup>
							) : (
								<option key={o.i} value={o.value + ''}>
									{o.name}
								</option>
							)
						)}
					</datalist>
				</div>
			)
		}
	}
)
const EditAttributeMultiSelect = wrapEditAttribute(
	class EditAttributeMultiSelect extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event: MultiSelectEvent) {
			this.handleUpdate(event.selectedValues)
		}
		getOptions() {
			let options: _.Dictionary<string | string[]> = {}

			if (Array.isArray(this.props.options)) {
				// is it an enum?
				for (let key in this.props.options) {
					let val = this.props.options[key]
					if (typeof val === 'object') {
						options[val.value] = val.name
					} else {
						options[val] = val
					}
				}
			} else if (typeof this.props.options === 'object') {
				// Is options an enum?
				let keys = Object.keys(this.props.options)
				let first = this.props.options[keys[0]]
				if (this.props.options[first] + '' === keys[0] + '') {
					// is an enum, only pick
					for (let key in this.props.options) {
						if (!_.isNaN(parseInt(key, 10))) {
							// key is a number (the key)
							let enumValue = this.props.options[key]
							let enumKey = this.props.options[enumValue]
							options[enumKey] = enumValue
						}
					}
				} else {
					for (let key in this.props.options) {
						let val = this.props.options[key]
						if (Array.isArray(val)) {
							options[key] = val
						} else {
							options[val] = key + ': ' + val
						}
					}
				}
			}

			return options
		}
		render() {
			return (
				<MultiSelect
					className={this.props.className}
					availableOptions={this.getOptions()}
					value={this.getAttribute()}
					placeholder={this.props.label}
					onChange={this.handleChange}></MultiSelect>
			)
		}
	}
)

const EditAttributeJson = wrapEditAttribute(
	class EditAttributeJson extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
			this.handleBlur = this.handleBlur.bind(this)
			this.handleEscape = this.handleEscape.bind(this)
		}
		isJson(str: string) {
			try {
				JSON.parse(str)
			} catch (err) {
				return false
			}
			return true
		}
		handleChange(event) {
			let v = event.target.value
			if (this.isJson(v)) {
				this.handleEdit(v)
				this.setState({
					valueError: false,
				})
			} else {
				this.handleUpdateButDontSave(v, true)
			}
		}
		handleBlur(event) {
			let v = event.target.value
			if (v === '') {
				v = '{}'
			}
			if (this.isJson(v)) {
				this.handleUpdate(v)
				this.setState({
					valueError: false,
				})
			} else {
				this.handleUpdateButDontSave(v, true)
				this.setState({
					valueError: true,
				})
			}
		}
		handleEscape(event) {
			let e = event as KeyboardEvent
			if (e.key === 'Escape') {
				this.handleDiscard()
			}
		}
		render() {
			return (
				<input
					type="text"
					className={ClassNames(
						'form-control',
						this.props.className,
						this.state.valueError && this.props.invalidClassName
							? this.props.invalidClassName
							: this.state.editing
							? this.props.modifiedClassName || ''
							: ''
					)}
					placeholder={this.props.label}
					value={this.getEditAttribute() || ''}
					onChange={this.handleChange}
					onBlur={this.handleBlur}
					onKeyUp={this.handleEscape}
					disabled={this.props.disabled}
				/>
			)
		}
	}
)

const EditAttributeColorPicker = wrapEditAttribute(
	class EditAttributeColorPicker extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event: ColorPickerEvent) {
			this.handleUpdate(event.selectedValue)
		}
		render() {
			return (
				<ColorPicker
					className={this.props.className}
					availableOptions={this.props.options}
					value={this.getAttribute()}
					placeholder={this.props.label}
					onChange={this.handleChange}></ColorPicker>
			)
		}
	}
)
const EditAttributeIconPicker = wrapEditAttribute(
	class extends EditAttributeBase {
		constructor(props) {
			super(props)

			this.handleChange = this.handleChange.bind(this)
		}
		handleChange(event: IconPickerEvent) {
			this.handleUpdate(event.selectedValue)
		}
		render() {
			return (
				<IconPicker
					className={this.props.className}
					availableOptions={this.props.options}
					value={this.getAttribute()}
					placeholder={this.props.label}
					onChange={this.handleChange}></IconPicker>
			)
		}
	}
)
