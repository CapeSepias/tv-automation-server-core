import { registerClassToMeteorMethods } from '../methods'
import { NewManualPlayoutAPI, ManualPlayoutAPIMethods } from '../../lib/api/manualPlayout'
import { Timeline, TimelineObjGeneric, getTimelineId, TimelineObjType } from '../../lib/collections/Timeline'
import { Studios, StudioId } from '../../lib/collections/Studios'
import { afterUpdateTimeline } from './playout/timeline'
import { check } from '../../lib/check'
import { makePromise, waitForPromise } from '../../lib/lib'
import { ServerClientAPI } from './client'
import { MethodContext, MethodContextAPI } from '../../lib/api/methods'
import { TimelineObjectCoreExt } from 'tv-automation-sofie-blueprints-integration'
import { StudioContentWriteAccess } from '../security/studio'
import { studioSyncFunction } from './ingest/rundownInput'

function insertTimelineObject(context: MethodContext, studioId: StudioId, timelineObjectOrg: TimelineObjectCoreExt) {
	check(studioId, String)

	StudioContentWriteAccess.timeline(context, studioId)

	const timelineObject: TimelineObjGeneric = {
		...timelineObjectOrg,

		_id: getTimelineId(studioId, timelineObjectOrg.id),
		studioId: studioId,
		objectType: TimelineObjType.MANUAL,
	}

	studioSyncFunction(studioId, (cache) => {
		cache.Timeline.upsert(timelineObject._id, timelineObject)
		afterUpdateTimeline(cache)
	})
}
function removeTimelineObject(context: MethodContext, studioId: StudioId, id: string) {
	check(studioId, String)
	check(id, String)

	StudioContentWriteAccess.timeline(context, studioId)

	studioSyncFunction(studioId, (cache) => {
		cache.Timeline.remove(getTimelineId(studioId, id))
		afterUpdateTimeline(cache)
	})
}

class ServerManualPlayoutAPI extends MethodContextAPI implements NewManualPlayoutAPI {
	insertTimelineObject(studioId: StudioId, timelineObject: TimelineObjectCoreExt) {
		return makePromise(() => {
			insertTimelineObject(this, studioId, timelineObject)
		})
	}
	removeTimelineObject(studioId: StudioId, id: string) {
		return makePromise(() => {
			removeTimelineObject(this, studioId, id)
		})
	}
}
registerClassToMeteorMethods(
	ManualPlayoutAPIMethods,
	ServerManualPlayoutAPI,
	false,
	(methodContext: MethodContext, methodName: string, args: any[], fcn: Function) => {
		return ServerClientAPI.runInUserLog(methodContext, '', methodName, args, () => {
			return fcn.apply(methodContext, args)
		})
	}
)
