import { Meteor } from 'meteor/meteor'
import * as _ from 'underscore'
import { LookaheadMode, Timeline as TimelineTypes, OnGenerateTimelineObj } from 'tv-automation-sofie-blueprints-integration'
import { Studio, MappingExt } from '../../../lib/collections/Studios'
import { TimelineObjGeneric, TimelineObjRundown, fixTimelineId, TimelineObjType } from '../../../lib/collections/Timeline'
import { Part } from '../../../lib/collections/Parts'
import { Piece } from '../../../lib/collections/Pieces'
import { getOrderedPiece } from './pieces'
import { literal, clone } from '../../../lib/lib'
import { RundownPlaylistPlayoutData } from '../../../lib/collections/RundownPlaylists'
import { PartInstance } from '../../../lib/collections/PartInstances'
import type { PieceInstance } from '../../../lib/collections/PieceInstances'

const LOOKAHEAD_OBJ_PRIORITY = 0.1

export function getLookeaheadObjects (rundownData: RundownPlaylistPlayoutData, studio: Studio): Array<TimelineObjGeneric> {
	const timelineObjs: Array<TimelineObjGeneric> = []
	const mutateAndPushObject = (rawObj: TimelineObjRundown, i: string, enable: TimelineObjRundown['enable'], mapping: MappingExt, priority: number) => {
		const obj: TimelineObjGeneric = clone(rawObj)

		obj.id = `lookahead_${i}_${obj.id}`
		obj.priority = priority
		obj.enable = enable
		obj.isLookahead = true
		delete obj.keyframes
		delete obj.inGroup // force it to be cleared

		if (mapping.lookahead === LookaheadMode.PRELOAD) {
			obj.lookaheadForLayer = obj.layer
			obj.layer += '_lookahead'
		}

		timelineObjs.push(obj)
	}

	const calculateStartAfterPreviousObj = (prevObj: TimelineObjRundown): TimelineTypes.TimelineEnable => {
		const prevHasDelayFlag = (prevObj.classes || []).indexOf('_lookahead_start_delay') !== -1

		// Start with previous piece
		const startOffset = prevHasDelayFlag ? 2000 : 0
		return {
			start: `#${prevObj.id}.start + ${startOffset}`
		}
	}

	_.each(studio.mappings || {}, (mapping: MappingExt, layerId: string) => {
		const lookaheadDepth = mapping.lookahead === LookaheadMode.PRELOAD ? mapping.lookaheadDepth || 1 : 1 // TODO - test other modes
		const lookaheadObjs = findLookaheadForlayer(rundownData, layerId, mapping.lookahead, lookaheadDepth)

		// Add the objects that have some timing info
		_.each(lookaheadObjs.timed, (entry, i) => {
			let enable: TimelineTypes.TimelineEnable = {
				start: 1 // Absolute 0 without a group doesnt work
			}
			if (i !== 0) {
				const prevObj = lookaheadObjs.timed[i - 1].obj
				enable = calculateStartAfterPreviousObj(prevObj)
			}
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			enable.end = `#${entry.obj.id}.start`

			mutateAndPushObject(entry.obj, `timed${i}`, enable, mapping, LOOKAHEAD_OBJ_PRIORITY)
		})

		// Add each of the future objects, that have no end point
		const futureObjCount = lookaheadObjs.future.length
		const futurePriorityScale = LOOKAHEAD_OBJ_PRIORITY / (futureObjCount + 1)
		_.each(lookaheadObjs.future, (entry, i) => {
			if (!entry.obj.id) throw new Meteor.Error(500, 'lookahead: timeline obj id not set')

			// WHEN_CLEAR mode can't take multiple futures, as they are always flattened into the single layer. so give it some real timings, and only output one
			const singleFutureObj = mapping.lookahead !== LookaheadMode.WHEN_CLEAR
			if (singleFutureObj && i !== 0) {
				return
			}

			const lastTimedObj = _.last(lookaheadObjs.timed)
			const enable = singleFutureObj && lastTimedObj ? calculateStartAfterPreviousObj(lastTimedObj.obj) : { while: '1' }
			// We use while: 1 for the enabler, as any time before it should be active will be filled by either a playing object, or a timed lookahead.
			// And this allows multiple futures to be timed in a way that allows them to co-exist

			// Prioritise so that the earlier ones are higher, decreasing within the range 'reserved' for lookahead
			const priority = singleFutureObj ? LOOKAHEAD_OBJ_PRIORITY : futurePriorityScale * (futureObjCount - i)
			mutateAndPushObject(entry.obj, `future${i}`, enable, mapping, priority)
		})
	})
	return timelineObjs
}

interface PartAndPieces {
	part: Part
	pieces: Piece[]
}

export interface LookaheadObjectEntry {
	obj: TimelineObjRundown
	partId: string
}

export interface LookaheadResult {
	timed: Array<LookaheadObjectEntry>
	future: Array<LookaheadObjectEntry>
}

export function findLookaheadForlayer (
	rundownData: RundownPlaylistPlayoutData,
	layer: string,
	mode: LookaheadMode,
	lookaheadDepth: number
	): LookaheadResult {

	const res: LookaheadResult = {
		timed: [],
		future: []
	}

	if (mode === undefined || mode === LookaheadMode.NONE) {
		return res
	}

	function getPartInstancePieces (partInstanceId: string) {
		return _.filter(rundownData.selectedInstancePieces, (pieceInstance: PieceInstance) => {
			return !!(
				pieceInstance.partInstanceId === partInstanceId &&
				pieceInstance.piece.content &&
				pieceInstance.piece.content.timelineObjects &&
				_.find(pieceInstance.piece.content.timelineObjects, (o) => (o && o.layer === layer))
			)
		})
	}

	// Track the previous info for checking how the timeline will be built
	let previousPartInfo: PartAndPieces | undefined
	if (rundownData.previousPartInstance) {
		const previousPieces = getPartInstancePieces(rundownData.previousPartInstance._id)
		previousPartInfo = {
			part: rundownData.previousPartInstance.part,
			pieces: previousPieces.map(p => p.piece)
		}
	}

	// Get the PieceInstances which are on the timeline
	const partInstancesOnTimeline = _.compact([
		rundownData.currentPartInstance,
		rundownData.currentPartInstance && rundownData.currentPartInstance.part.autoNext ? rundownData.nextPartInstance : undefined
	])
	// Generate timed objects for parts on the timeline
	_.each(partInstancesOnTimeline, partInstance => {
		const pieces = _.filter(rundownData.selectedInstancePieces, (pieceInstance: PieceInstance) => {
			return !!(
				pieceInstance.partInstanceId === partInstance._id &&
				pieceInstance.piece.content &&
				pieceInstance.piece.content.timelineObjects &&
				_.find(pieceInstance.piece.content.timelineObjects, (o) => (o && o.layer === layer))
			)
		})
		const partInfo = {
			part: partInstance.part,
			pieces: pieces.map(p => p.piece)
		}

		findObjectsForPart(rundownData, layer, previousPartInfo, partInfo)
			.forEach(o => res.timed.push({ obj: o, partId: partInstance.part._id }))
		previousPartInfo = partInfo
	})

	// find all pieces that touch the layer
	const piecesUsingLayer = _.filter(rundownData.pieces, (piece: Piece) => {
		return !!(
			piece.content &&
			piece.content.timelineObjects &&
			_.find(piece.content.timelineObjects, (o) => (o && o.layer === layer))
		)
	})
	if (piecesUsingLayer.length === 0) {
		return res
	}

	// nextPartInstance should always have a backing part (if it exists), so this will be safe
	const nextPartIndex = selectNextPartIndex(rundownData.nextPartInstance || rundownData.currentPartInstance || null, rundownData.parts)
	const futureParts = nextPartIndex !== -1 ? rundownData.parts.slice(nextPartIndex) : []
	if (futureParts.length === 0) {
		return res
	}

	// have pieces grouped by part, so we can look based on rank to choose the correct one
	const piecesUsingLayerByPart: {[partId: string]: Piece[] | undefined} = {}
	piecesUsingLayer.forEach(i => {
		if (!piecesUsingLayerByPart[i.partId]) {
			piecesUsingLayerByPart[i.partId] = []
		}

		piecesUsingLayerByPart[i.partId]!.push(i)
	})

	for (const part of futureParts) {
		// Stop if we have enough objects already
		if (res.future.length >= lookaheadDepth) {
			break
		}

		const pieces = piecesUsingLayerByPart[part._id] || []
		if (pieces.length > 0 && part.isPlayable()) {
			const partInfo = { part, pieces }
			// TODO
			findObjectsForPart(rundownData, layer, previousPartInfo, partInfo)
				.forEach(o => res.future.push({ obj: o, partId: part._id }))
			previousPartInfo = partInfo
		}
	}

	return res
}

function selectNextPartIndex (currentPartInstance: PartInstance | null, parts: Part[]): number {
	// TODO-ASAP refactor and reuse to select the next part for playout too
	if (currentPartInstance === null) {
		return parts.length ? 0 : -1
	}

	const currentIndex = parts.findIndex(p => p._id === currentPartInstance.part._id)
	if (currentIndex === -1) return -1

	// Filter to after and find the first playabale
	const possibleParts = parts.slice(currentIndex + 1)
	return possibleParts.findIndex(p => p.isPlayable())
}

function selectNextPart (currentPartInstance: PartInstance | null, parts: Part[]): Part | undefined {
	const index = selectNextPartIndex(currentPartInstance, parts)
	return index !== -1 ? parts[index] : undefined
}

function findObjectsForPart (
	rundownData: RundownPlaylistPlayoutData,
	layer: string,
	previousPartInfo: PartAndPieces | undefined,
	partInfo: PartAndPieces,
): (TimelineObjRundown & OnGenerateTimelineObj)[] {
	const activePlaylist = rundownData.rundownPlaylist
	const activeRundown = rundownData.rundownsMap[partInfo.part.rundownId]

	// Sanity check, if no part to search, then abort
	if (!partInfo || partInfo.pieces.length === 0) {
		return []
	}

	let allObjs: TimelineObjRundown[] = []
	partInfo.pieces.forEach(i => {
		if (i.content && i.content.timelineObjects) {

			_.each(i.content.timelineObjects, (obj) => {
				if (obj) {
					fixTimelineId(obj)
					allObjs.push(literal<TimelineObjRundown & OnGenerateTimelineObj>({
						...obj,
						_id: '', // set later
						studioId: '', // set later
						objectType: TimelineObjType.RUNDOWN,
						rundownId: activeRundown._id,
						playlistId: activePlaylist._id,
						pieceId: i._id,
						infinitePieceId: i.infiniteId
					}))
				}
			})
		}
	})
	// let allObjs: TimelineObjRundown[] = _.compact(rawObjs)

	if (allObjs.length === 0) {
		// Should never happen. suggests something got 'corrupt' during this process
		return []
	} else if (allObjs.length === 1) {
		// Only one, just return it
		return allObjs
	} else { // They need to be ordered
		const orderedItems = getOrderedPiece(partInfo.part)

		let allowTransition = false
		let classesFromPreviousPart: string[] = []
		if (previousPartInfo && activePlaylist.currentPartInstanceId) { // If we have a previous and not at the start of the rundown
			allowTransition = !previousPartInfo.part.disableOutTransition
			classesFromPreviousPart = previousPartInfo.part.classesForNext || []
		}

		const transObj = orderedItems.find(i => !!i.isTransition)
		const transObj2 = transObj ? partInfo.pieces.find(l => l._id === transObj._id) : undefined
		const hasTransition = (
			allowTransition &&
			transObj2 &&
			transObj2.content &&
			transObj2.content.timelineObjects &&
			transObj2.content.timelineObjects.find(o => o != null && o.layer === layer)
		)

		const res: TimelineObjRundown[] = []
		orderedItems.forEach(i => {
			if (!partInfo || (!allowTransition && i.isTransition)) {
				return
			}

			const piece = partInfo.pieces.find(l => l._id === i._id)
			if (!piece || !piece.content || !piece.content.timelineObjects) {
				return
			}

			// If there is a transition and this piece is abs0, it is assumed to be the primary piece and so does not need lookahead
			if (
				hasTransition &&
				!i.isTransition &&
				piece.enable.start === 0 // <-- need to discuss this!
			) {
				return
			}

			// Note: This is assuming that there is only one use of a layer in each piece.
			const obj = piece.content.timelineObjects.find(o => o !== null && o.layer === layer)
			if (obj) {
				// Try and find a keyframe that is used when in a transition
				let transitionKF: TimelineTypes.TimelineKeyframe | undefined = undefined
				if (allowTransition) {
					transitionKF = _.find(obj.keyframes || [], kf => kf.enable.while === '.is_transition')

					// TODO - this keyframe matching is a hack, and is very fragile

					if (!transitionKF && classesFromPreviousPart && classesFromPreviousPart.length > 0) {
						// Check if the keyframe also uses a class to match. This handles a specific edge case
						transitionKF = _.find(obj.keyframes || [], kf => _.any(classesFromPreviousPart, cl => kf.enable.while === `.is_transition & .${cl}`))
					}
				}
				const newContent = Object.assign({}, obj.content, transitionKF ? transitionKF.content : {})

				res.push(literal<TimelineObjRundown & OnGenerateTimelineObj>({
					...obj,
					_id: '', // set later
					studioId: '', // set later
					objectType: TimelineObjType.RUNDOWN,
					rundownId: activeRundown._id,
					playlistId: activePlaylist._id,
					pieceId: piece._id,
					infinitePieceId: piece.infiniteId,
					content: newContent
				}))
			}
		})
		return res
	}

	return allObjs
}
