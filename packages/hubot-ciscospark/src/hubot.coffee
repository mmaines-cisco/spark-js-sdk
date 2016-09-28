{
  Adapter,
  TextMessage
} = require 'hubot'
make = require './ciscospark'

class SparkAdapter extends Adapter
  reply: (envelope, strings...) ->
    @send envelope, strings...

  run: =>
    @robot.brain.once 'loaded', =>
      @spark = make @robot
      @spark.mercury.on 'change:connected', =>
        if (@spark.mercury.connected)
          @emit 'online'

          @send
            room:
              id: '402dbf77-123b-3283-8a52-5e67087c4d9e'
          , 'online'
        else
          @emit 'offline'

      @spark.once 'change:canAuthorize', =>
        if @spark.canAuthorize
          @spark.mercury.connect()

      @spark.mercury.on 'event:conversation.activity', (activity) =>
        @onActivity activity

    @emit 'connected'

  send: (envelope, strings...) ->
    strings.reduce (promise, string) =>
      promise.then () =>
        @spark.conversation.post(envelope.room, displayName: string)
          .catch (err) =>
            @robot.logger.error err
    , Promise.resolve()
    .catch (err) =>
      @robot.logger.error err

  onActivity: (message) =>
    activity = message.data.activity
    console.log activity

    return if activity.actor.id is @spark.device.userId

    @spark.conversation.get
      url: (activity.target || activity.object).url
    .then (conversation) =>
      console.log 1
      user = @robot.brain.userForId activity.actor.id,
        name: activity.actor.displayName
        room: conversation
      console.log 2

      switch activity.verb
        when 'post'
          console.log 3
          text = activity.object.displayName
          # console.info "Received message: #{text} in room : #{conversation.id}, from: #{user.name}"
          if conversation.tags.includes 'ONE_ON_ONE'
            console.log 4
            text = "#{@robot.name} #{text}"
            console.log 5
          console.log text
          @receive new TextMessage user, text, activity.url
          console.log 6
    .catch (reason) =>
      console.log reason

exports.use = (robot) ->
  new SparkAdapter robot
