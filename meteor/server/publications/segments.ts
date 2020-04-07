import { Meteor } from 'meteor/meteor'

import { RundownSecurity } from '../security/collections/rundowns'
import { Segments } from '../../lib/collections/Segments'
import { meteorPublish } from './lib'
import { PubSub } from '../../lib/api/pubsub'

meteorPublish(PubSub.segments, function (selector, token) {
	if (!selector) throw new Meteor.Error(400,'selector argument missing')
	const modifier = {
		fields: {
			token: 0
		}
	}
	if (RundownSecurity.allowReadAccess(selector, token, this)) {
		return Segments.find(selector, modifier)
	}
	return null
})
