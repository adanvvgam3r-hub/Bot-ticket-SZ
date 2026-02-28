const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes } = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

const TOKEN = process.env.DISCORD_TOKEN;
const ID_STAFF = '1453126709447754010';
const ID_CATEGORIA = process.env.ID_CATEGORIA; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_AVISOS_EQUIPE = '1476775424540282934';

client.once('ready', async () => {
    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel completo de tickets',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ /setupsz pronto!');
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    // --- PAINEL PRINCIPAL (/setupsz) ---
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Precisa de ajuda ou quer denunciar algo?\nUse o menu ou o botão abaixo para iniciar.')
            .setColor('#2b2d31');

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('iniciar_ticket').setLabel('ABRIR TICKET').setEmoji('📩').setStyle(ButtonStyle.Success)
        );

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_categoria').setPlaceholder('Escolha a categoria rápida...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'cat_ban', emoji: '🔨' },
                    { label: 'FALHA EM AP', value: 'cat_ap', emoji: '💰' },
                    { label: 'FALHA EM SIMU', value: 'cat_simu', emoji: '🏆' }
                ])
        );

        await i.reply({ content: '✅ Painel enviado!', ephemeral: true });
        await i.channel.send({ embeds: [embed], components: [btn, menu] });
    }

    // --- CRIAÇÃO DO CANAL ---
    if ((i.isButton() && i.customId === 'iniciar_ticket') || (i.isStringSelectMenu() && i.customId === 'menu_categoria')) {
        const tipo = i.values?.[0] || 'cat_geral';
        const canal = await i.guild.channels.create({
            name: `sz-${tipo.replace('cat_', '')}-${i.user.username}`,
            type: ChannelType.GuildText,
            parent: ID_CATEGORIA,
            permissionOverwrites: [
                { id: i.guild.id, deny: [PermissionFlagsBits.ViewChannel] },
                { id: i.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.AttachFiles] },
                { id: ID_STAFF, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] }
            ]
        });

        const menuOcorrido = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`ocorrido_${tipo}`).setPlaceholder('Qual foi o ocorrido?')
                .addOptions(tipo === 'cat_ban' ? [{ label: 'Xingamento', value: 'xingamento' }, { label: 'Mídia', value: 'midia' }, { label: 'Outro', value: 'outro_ban' }] :
                            tipo === 'cat_ap' ? [{ label: 'Vitória Errada', value: 'vit_ap' }, { label: 'Pagamento', value: 'pag_ap' }, { label: 'Outro', value: 'outro_ap' }] :
                            [{ label: 'Vitória Errada', value: 'vit_simu' }, { label: 'Favoritismo', value: 'fav_simu' }, { label: 'Outro', value: 'outro_simu' }])
        );

        await canal.send({ content: `${i.user} | <@&${ID_STAFF}>\n📩 *Levaremos a situação para equipe...*`, components: [menuOcorrido] });
        await i.reply({ content: `✅ Ticket: ${canal}`, ephemeral: true }).catch(() => i.update({ content: `✅ Ticket: ${canal}`, components: [], ephemeral: true }));
    }

    // --- MODAL DE DETALHES ---
    if (i.isStringSelectMenu() && i.customId.startsWith('ocorrido_')) {
        const modal = new ModalBuilder().setCustomId('modal_sz').setTitle('DETALHES');
        const qm = new TextInputBuilder().setCustomId('quem').setLabel("QUEM FOI?").setPlaceholder("Ex: @batata ou @picles").setStyle(TextInputStyle.Short).setRequired(true);
        const rel = new TextInputBuilder().setCustomId('relato').setLabel("RELATO").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(qm), new ActionRowBuilder().addComponents(rel));
        return await i.showModal(modal);
    }

    // --- RECEBER MODAL E ENVIAR PARA A EQUIPE ---
    if (i.type === InteractionType.ModalSubmit && i.customId === 'modal_sz') {
        const quem = i.fields.getTextInputValue('quem');
        const relato = i.fields.getTextInputValue('relato');

        const embedEquipe = new EmbedBuilder()
            .setTitle('🚨 NOVA DENÚNCIA RECEBIDA')
            .addFields(
                { name: '👤 Denunciador:', value: `<@${i.user.id}>`, inline: true },
                { name: '👤 Acusado:', value: quem, inline: true },
                { name: '📝 Relato:', value: relato }
            ).setColor('#f1c40f').setTimestamp();

        const btnEquipe = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`chat_${i.user.id}`).setLabel('ABRIR TÓPICO').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`dm_${i.user.id}`).setLabel('AVISAR RESOLVIDO (DM)').setStyle(ButtonStyle.Success)
        );

        const logChan = i.guild.channels.cache.get(CANAL_AVISOS_EQUIPE);
        if (logChan) await logChan.send({ embeds: [embedEquipe], components: [btnEquipe] });

        const btnFechar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar_tkt').setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger));
        await i.reply({ content: '✅ Relato enviado para a equipe!', embeds: [embedEquipe], components: [btnFechar] });
    }

    // --- BOTÕES DA EQUIPE ---
    if (i.isButton()) {
        const targetId = i.customId.split('_')[1];
        if (i.customId.startsWith('chat_')) {
            const thread = await i.channel.threads.create({ name: `conversa-${targetId}`, type: ChannelType.PrivateThread });
            await thread.members.add(i.user.id); await thread.members.add(targetId);
            await thread.send(`👋 <@${targetId}>, a Staff <@${i.user.id}> quer conversar sobre sua denúncia.`);
            await i.reply({ content: `✅ Tópico: ${thread}`, ephemeral: true });
        }
        if (i.customId.startsWith('dm_')) {
            const user = await client.users.fetch(targetId);
            await user.send(`✅ Olá! Sua denúncia no **Alpha** foi analisada e o problema foi resolvido. Obrigado!`).catch(() => {});
            await i.reply({ content: '✅ DM enviada!', ephemeral: true });
        }
        if (i.customId === 'fechar_tkt') {
            await i.reply('🔒 Fechando...');
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }
    }
});

client.login(TOKEN);
