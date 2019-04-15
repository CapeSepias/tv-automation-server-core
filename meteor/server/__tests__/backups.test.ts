
import { restoreRunningOrder } from '../backups'
import { PeripheralDevices } from '../../lib/collections/PeripheralDevices'
import { getCurrentTime } from '../../lib/lib'
import { StatusCode } from '../systemStatus'
import { PeripheralDeviceAPI } from '../../lib/api/peripheralDevice'
import { RunningOrders } from '../../lib/collections/RunningOrders'
import { MeteorMock } from '../../__mocks__/meteor'

jest.mock('meteor/meteor', require('../../__mocks__/meteor').setup, { virtual: true })
jest.mock('meteor/random', require('../../__mocks__/random').setup, { virtual: true })
jest.mock('meteor/meteorhacks:picker', require('../../__mocks__/meteorhacks-picker').setup, { virtual: true })
jest.mock('meteor/mongo', require('../../__mocks__/mongo').setup, { virtual: true })

describe('backups', () => {

	test('restoreRunningOrder', () => {

		PeripheralDevices.insert({
			_id: 'mockMos',
			type: PeripheralDeviceAPI.DeviceType.MOSDEVICE,
			name: '',

			created: getCurrentTime(),
			status: {
				statusCode: StatusCode.GOOD,
			},
			lastSeen: getCurrentTime(),
			lastConnected: getCurrentTime(),

			connected: true,
			connectionId: 'abcConnectionId',
			token: 'abcToken'

		})

		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoDelete] = jest.fn()
		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoCreate] = jest.fn()
		MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoFullStory] = jest.fn()

		restoreRunningOrder({
			type: 'runningOrderCache',
			data: [
				{
					type: 'roCreate',
					data: {
						ID: 'ro0',
						Stories: [
							{
								ID: 'story0'
							}
						]
					}
				},
				{
					type: 'fullStory',
					data: {
						ID: 'story0'
					}
				}
			]
		})

		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoDelete]).toHaveBeenCalledTimes(1)
		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoCreate]).toHaveBeenCalledTimes(1)
		expect(MeteorMock.mockMethods[PeripheralDeviceAPI.methods.mosRoFullStory]).toHaveBeenCalledTimes(1)
	})
})
