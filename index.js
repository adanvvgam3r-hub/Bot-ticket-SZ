const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes, Collection, AttachmentBuilder, ActivityType } = require('discord.js');
const fs = require('fs');
const path = require('path');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent, 
        GatewayIntentBits.GuildMembers,
        GatewayIntentBits.DirectMessages
    ] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const ID_STAFF = '1452822605773148312'; 
const CANAL_POST = '1476773027516518470';
const CANAL_LOGS = '1476775424540282934';

const ticketSessions = new Collection();
const threadCache = new Collection();
const cooldownSystem = new Collection();
const staffMetrics = new Collection();

process.on('unhandledRejection', (reason) => { console.error(reason); });
process.on('uncaughtException', (err) => { console.error(err); });

async function createTranscript(channel, user) {
    try {
        const messages = await channel.messages.fetch({ limit: 100 });
        let log = `RELATÓRIO DE AUDITORIA ALPHA\n`;
        log += `Ticket: ${channel.name}\nUsuário: ${user.tag} (${user.id})\n`;
        log += `Data: ${new Date().toLocaleString()}\n`;
        log += `--------------------------------------------------\n\n`;

        messages.reverse().forEach(m => {
            const time = m.createdAt.toLocaleTimeString();
            log += `[${time}] ${m.author.tag}: ${m.cleanContent || "[Midia/Embed]"}\n`;
        });

        const fileName = `audit-${channel.id}.txt`;
        const filePath = path.join(__dirname, fileName);
        fs.writeFileSync(filePath, log);
        return { filePath, fileName };
    } catch (e) { return null; }
}

client.once('ready', async () => {
    console.log(`Logado: ${client.user.tag}`);
    client.user.setActivity('Tickets Alpha 2026', { type: ActivityType.Watching });

    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel de tickets Alpha',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];

    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channelId !== CANAL_POST) {
            return i.reply({ content: `❌ Use em <#${CANAL_POST}>`, ephemeral: true });
        }

        const embedMain = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Selecione a categoria no menu e clique no botão para iniciar seu ticket.\n\n🔒 **Privacidade:** A primeira etapa é um tópico privado entre você e o bot.')
            .setColor('#2b2d31')
            .setFooter({ text: 'Alpha Supreme System' });

        const menuMain = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('main_select').setPlaceholder('Escolha a categoria principal...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'CAT_BAN', emoji: '🔨' },
                    { label: 'SIMU (Simulados)', value: 'CAT_SIMU', emoji: '🏆' },
                    { label: 'FALHA EM AP', value: 'CAT_AP', emoji: '💰' }
                ])
        );

        const btnMain = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('open_ticket').setLabel('ABRIR TICKET').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        await i.reply({ content: '✅ Painel gerado!', ephemeral: true });
        return i.channel.send({ embeds: [embedMain], components: [menuMain, btnMain] });
    }

    if (i.isStringSelectMenu() && i.customId === 'main_select') {
        await i.deferUpdate();
        return ticketSessions.set(i.user.id, i.values[0]);
    }

    if (i.isButton() && i.customId === 'open_ticket') {
        const cat = ticketSessions.get(i.user.id);
        if (!cat) return i.reply({ content: '❌ Selecione uma categoria no menu primeiro!', ephemeral: true });

        if (cooldownSystem.has(i.user.id)) {
            return i.reply({ content: '⏳ Você já tem um ticket em andamento.', ephemeral: true });
        }

        try {
            const threadSolo = await i.channel.threads.create({
                name: `coleta-${i.user.username}`,
                type: ChannelType.PrivateThread,
                autoArchiveDuration: 60
            });

            await threadSolo.members.add(i.user.id);
            threadCache.set(i.user.id, threadSolo.id);
            cooldownSystem.set(i.user.id, Date.now());

            let rowSub;
            if (cat === 'CAT_BAN') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ban').setPlaceholder('BAN: Escolha o motivo...')
                    .addOptions([
                        { label: 'Xingamento', value: 'Xingamento', emoji: '🤬' },
                        { label: 'Foto Inapropriada', value: 'Foto Inapropriada', emoji: '🔞' },
                        { label: 'Ameaça', value: 'Ameaça', emoji: '🚨' },
                        { label: 'Outro', value: 'Outro', emoji: '⚙️' }
                    ]));
            } else if (cat === 'CAT_SIMU') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_simu').setPlaceholder('SIMU: Escolha o motivo...')
                    .addOptions([
                        { label: 'Favoritismo', value: 'Favoritismo', emoji: '⭐' },
                        { label: 'Partidas Repetidas', value: 'Partidas Repetidas', emoji: '🔁' }
                    ]));
            } else if (cat === 'CAT_AP') {
                rowSub = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId('sub_ap').setPlaceholder('AP: Escolha o motivo...')
                    .addOptions([
                        { label: 'Desrespeito', value: 'Desrespeito', emoji: '😤' },
                        { label: 'Dinheiro Errado', value: 'Dinheiro Errado', emoji: '❌' },
                        { label: 'Valor não pago', value: 'Valor não pago', emoji: '📉' }
                    ]));
            }

            const btnCancel = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('cancel_ticket').setLabel('CANCELAR').setStyle(ButtonStyle.Danger));

            await threadSolo.send({ content: `👋 ${i.user}, você selecionou **${cat.replace('CAT_', '')}**.\nSelecione o ocorrido abaixo para abrir o formulário:`, components: [rowSub, btnCancel] });
            return i.reply({ content: `✅ Tópico de coleta privado: ${threadSolo}`, ephemeral: true });

        } catch (e) {
            return i.reply({ content: '❌ Erro ao criar tópico. Verifique as permissões.', ephemeral: true });
        }
    }

    if (i.isButton() && i.customId === 'cancel_ticket') {
        cooldownSystem.delete(i.user.id);
        await i.reply('🔒 Cancelando...');
        return setTimeout(() => i.channel.delete().catch(() => {}), 2000);
    }

    if (i.isStringSelectMenu() && i.customId.startsWith('sub_')) {
        const sub = i.values[0];
        const cat = i.customId.replace('sub_', '').toUpperCase();
        let modal = new ModalBuilder().setCustomId(`form_final|${cat}|${sub}`).setTitle(`${cat}: ${sub}`);

        if (sub === 'Xingamento' || sub === 'Desrespeito') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("QUAL FOI A MENSAGEM?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Foto Inapropriada') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("CONTEÚDO DA FOTO?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Ameaça') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q').setLabel("QUEM FOI?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('m').setLabel("QUAL A AMEAÇA? (OBRIGATÓRIO PRINT)").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else if (sub === 'Favoritismo') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1').setLabel("QUEM FOI AJUDADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Partidas Repetidas') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c1').setLabel("O QUE FOI FALADO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c2').setLabel("O QUE REALMENTE ACONTECEU?").setStyle(TextInputStyle.Paragraph).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c3').setLabel("QUEM FOI O MENTIROSO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('c4').setLabel("DONO DA COPA?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Dinheiro Errado') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v1').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v2').setLabel("VALOR PROPOSTO?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v3').setLabel("VALOR PAGO?").setStyle(TextInputStyle.Short).setRequired(true))
            );
        } else if (sub === 'Valor não pago') {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v1').setLabel("QUEM?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v2').setLabel("QUAL VALOR?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('v3').setLabel("PORQUE NÃO PAGOU?").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        } else {
            modal.addComponents(
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('x1').setLabel("O QUE OCORREU?").setStyle(TextInputStyle.Short).setRequired(true)),
                new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('x2').setLabel("RELATO COMPLETO").setStyle(TextInputStyle.Paragraph).setRequired(true))
            );
        }

        return await i.showModal(modal);
    }

    if (i.type === InteractionType.ModalSubmit && i.customId.startsWith('form_final|')) {
        const [_, cat, sub] = i.customId.split('|');
        
        const dataFields = i.fields.fields.map(f => {
    // Mapeia o ID interno para o nome real da pergunta
    const nomes = {
        'q': 'QUEM FOI',
        'm': 'RELATO/MENSAGEM',
        'q1': 'AJUDADO',
        'q2': 'DONO DA COPA',
        'c1': 'O QUE FOI FALADO',
        'c2': 'O QUE ACONTECEU',
        'v1': 'VALOR',
        'v2': 'VALOR PROPOSTO',
        'v3': 'VALOR PAGO'
    };

    // Pega o nome do dicionário acima ou usa o ID como fallback
    const pergunta = nomes[f.customId] || f.customId.toUpperCase();
    return `**${pergunta}:** ${f.value}`;
}).join('\n');



        const embedLog = new EmbedBuilder()
            .setTitle(`🚨 Nova Denúncia | @「 STAFF 」`)
            .setDescription(`**Revisão Pendente [${cat}]**\n\n**RECEBIMENTO: SIM**\n\n**Denunciador:** <@${i.user.id}>\n**Motivo:** ${sub}\n\n**Dados do Relatório:**\n${dataFields}`)
            .setColor('#f1c40f')
            .setTimestamp()
            .setThumbnail(i.user.displayAvatarURL());

        const rowActions = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`st_talk_${i.user.id}`).setLabel('INTERAGIR').setStyle(ButtonStyle.Primary).setEmoji('💬'),
            new ButtonBuilder().setCustomId(`st_done_${i.user.id}`).setLabel('RESOLVIDO').setStyle(ButtonStyle.Success).setEmoji('✅'),
            new ButtonBuilder().setCustomId(`st_fail_${i.user.id}`).setLabel('INSUFICIENTE').setStyle(ButtonStyle.Danger).setEmoji('❌')
        );

        const lChan = i.guild.channels.cache.get(CANAL_LOGS);
        if (lChan) await lChan.send({ content: `🚨 **Novo Requerimento [${cat}]** | <@&${ID_STAFF}>`, embeds: [embedLog], components: [rowActions] });

        await i.reply({ content: '✅ Relatório enviado! A Staff analisará sua denúncia.', ephemeral: true });
        
        const ctid = threadCache.get(i.user.id);
        if (ctid) {
            const chan = i.guild.channels.cache.get(ctid);
            if (chan) setTimeout(() => chan.delete().catch(() => {}), 2000);
            threadCache.delete(i.user.id);
        }
    }

    if (i.isButton() && i.customId.startsWith('st_')) {
        const [_, act, uid] = i.customId.split('_');
        const user = await client.users.fetch(uid).catch(() => null);

        if (act === 'talk') {
            const canalDestino = client.channels.cache.get('1476773027516518470');
const threadInteracao = await canalDestino.threads.create({
    name: `interacao-${uid}`,
    type: ChannelType.PrivateThread, // Use Private para ninguém mais ver
    autoArchiveDuration: 60
});
            await threadInteracao.members.add(uid);
            await threadInteracao.send({ 
                content: `👋 <@${uid}>, a Staff <@${i.user.id}> iniciou o contato.\n\n🛠️ Use para encerrar:`, 
                components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`end_all_${uid}`).setLabel('ENCERRAR E GERAR LOG').setStyle(ButtonStyle.Danger))] 
            });
            return i.reply({ content: `✅ Tópico aberto: ${threadInteracao}`, ephemeral: true });
        }

        if (act === 'done') {
            if (user) await user.send(`✅ **Alpha Atendimento:** Seu caso foi analisado e marcado como **RESOLVIDO**.`).catch(() => {});
            await i.update({ content: `✅ **RESOLVIDO** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            cooldownSystem.delete(uid);
        }

        if (act === 'fail') {
            if (user) await user.send(`❌ **Alpha Atendimento:** Analisamos seu caso, mas não houve evidências suficientes.`).catch(() => {});
            await i.update({ content: `❌ **INSUFICIENTE** por <@${i.user.id}>`, components: [], embeds: i.message.embeds });
            cooldownSystem.delete(uid);
        }
    }

    if (i.isButton() && i.customId.startsWith('end_all_')) {
        const uid = i.customId.split('_');
        const { filePath } = await createTranscript(i.channel, { tag: `user-${uid}`, id: uid });
        const auditChan = i.guild.channels.cache.get(CANAL_LOGS);
        if (auditChan) await auditChan.send({ content: `📁 Transcript Gerado:`, files: [new AttachmentBuilder(filePath)] });
        await i.reply('🔒 Encerrando...');
        setTimeout(() => { 
            if (fs.existsSync(filePath)) fs.unlinkSync(filePath); 
            i.channel.delete().catch(() => {}); 
            cooldownSystem.delete(uid); 
        }, 5000);
    }
});

client.login(TOKEN);
