import type { CommandInteraction } from "discord.js";
import { GuildMember } from "discord.js";
import type { ArgsOf, Client } from "discordx";
import { Discord, Once, Slash, SlashOption } from "discordx";

import * as Lava from "@discordx/lava-player";

@Discord()
// eslint-disable-next-line @typescript-eslint/no-unused-vars
class MusicPlayer {
  lavaLinkNode: Lava.Node | undefined;

  @Once("ready")
  onReady([]: ArgsOf<"ready">, client: Client): void {
    if (!client.user) {
      return;
    }

    const lavaLinkNode = new Lava.Node({
      host: {
        address: process.env.LAVA_HOST ? process.env.LAVA_HOST : "lavalink",
        connectionOptions: { resumeKey: "discordx", resumeTimeout: 15 },
        port: process.env.LAVA_PORT ? Number(process.env.LAVA_PORT) : 2333,
      },

      // your Lavalink password
      password: process.env.LAVA_PASSWORD ?? "",

      send(guildId, packet) {
        const guild = client.guilds.cache.get(guildId);
        if (guild) {
          guild.shard.send(packet);
        }
      },
      shardCount: 0, // the total number of shards that your bot is running (optional, useful if you're load balancing)
      userId: client.user.id, // the user id of your bot
    });

    lavaLinkNode.connection.ws.on("message", async (data) => {
      const raw = JSON.parse(data.toString()) as Lava.WRawEventType;
      if (raw.op === "event") {
        if (raw.type === "TrackStartEvent") {
          const track = await lavaLinkNode.http.decode(raw.track);
          console.log(track);
        }
      }
      console.log("ws>>", raw);
    });

    lavaLinkNode.on("error", (e) => {
      console.log(e);
    });

    client.ws.on("VOICE_STATE_UPDATE", (data: Lava.VoiceStateUpdate) => {
      lavaLinkNode.voiceStateUpdate(data);
    });

    client.ws.on("VOICE_SERVER_UPDATE", (data: Lava.VoiceServerUpdate) => {
      lavaLinkNode.voiceServerUpdate(data);
    });

    this.lavaLinkNode = lavaLinkNode;
  }

  @Slash()
  async join(interaction: CommandInteraction): Promise<void> {
    await interaction.deferReply();

    if (!(interaction.member instanceof GuildMember) || !interaction.guildId) {
      interaction.followUp("could not process this command, try again");
      return;
    }

    if (!this.lavaLinkNode) {
      interaction.followUp("lavalink player is not ready");
      return;
    }

    if (!interaction.member.voice.channelId) {
      interaction.followUp("please join a voice channel first");
      return;
    }

    const player = this.lavaLinkNode.players.get(interaction.guildId);
    await player.join(interaction.member.voice.channelId, { deaf: true });

    interaction.followUp("I am ready to rock :smile:");

    return;
  }

  @Slash()
  async play(
    @SlashOption("song") song: string,
    interaction: CommandInteraction
  ): Promise<void> {
    await interaction.deferReply();

    if (!(interaction.member instanceof GuildMember) || !interaction.guildId) {
      interaction.followUp("could not process this command, try again");
      return;
    }

    if (!this.lavaLinkNode) {
      interaction.followUp("lavalink player is not ready");
      return;
    }

    if (!interaction.member.voice.channelId) {
      interaction.followUp("please join a voice channel first");
      return;
    }

    const player = this.lavaLinkNode.players.get(interaction.guildId);

    if (!player.voiceServer) {
      await player.join(interaction.member.voice.channelId, { deaf: true });
    }

    const res = await this.lavaLinkNode.load(`ytsearch:${song}`);
    const track = res.tracks[0];

    if (track) {
      await player.play(track);
      await interaction.followUp(`playing ${track.info.title}`);
    } else {
      await interaction.followUp("Song not found with given input");
    }

    return;
  }
}
