const { Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, TextInputStyle, InteractionType, REST, Routes } = require('discord.js');

const client = new Client({ 
    intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] 
});

// Variáveis de Ambiente do Railway
const TOKEN = process.env.DISCORD_TOKEN;
const ID_STAFF = '1453126709447754010';
const ID_CATEGORIA = process.env.ID_CATEGORIA; 
const CANAL_TICKET_POST = '1476773027516518470';
const CANAL_LOGS_DENUNCIA = '1476775424540282934';

// Registro automático do comando /setupsz
client.once('ready', async () => {
    console.log(`🚀 Ticket-SZ Online: ${client.user.tag}`);
    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel de tickets no canal oficial',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comando /setupsz registrado!');
    } catch (error) { console.error(error); }
});

client.on('interactionCreate', async (i) => {
    // --- COMANDO /SETUPSZ ---
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channel.id !== CANAL_TICKET_POST) return i.reply({ content: `❌ Use em <#${CANAL_TICKET_POST}>`, ephemeral: true });
        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Precisa de ajuda, fazer uma denúncia ou relatar uma falha?\nClique no botão abaixo para iniciar seu atendimento.')
            .setColor('#2b2d31');
        const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('iniciar_ticket').setLabel('ABRIR TICKET').setEmoji('📩').setStyle(ButtonStyle.Success));
        await i.reply({ content: '✅ Painel postado!', ephemeral: true });
        await i.channel.send({ embeds: [embed], components: [row] });
    }

    // --- BOTÃO INICIAL -> MENU DE CATEGORIAS ---
    if (i.isButton() && i.customId === 'iniciar_ticket') {
        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_categoria').setPlaceholder('Escolha a categoria...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'cat_ban', emoji: '🔨' },
                    { label: 'FALHA EM AP', value: 'cat_ap', emoji: '💰' },
                    { label: 'FALHA EM SIMU', value: 'cat_simu', emoji: '🏆' }
                ])
        );
        return i.reply({ content: 'Selecione a categoria:', components: [menu], ephemeral: true });
    }

    // --- CRIAÇÃO DO CANAL E MENU DE OCORRIDO ---
    if (i.isStringSelectMenu() && i.customId === 'menu_categoria') {
        const tipo = i.values[0];
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

        const embedTkt = new EmbedBuilder()
            .setTitle(`📩 ATENDIMENTO: ${tipo.replace('cat_', '').toUpperCase()}`)
            .setDescription(`Olá ${i.user}, selecione o **OCORRIDO** abaixo.\n\n📩 *Levaremos a situação para equipe, pode ser que entremos em contato.*`)
            .setColor('#5865F2');

        let opcoes = tipo === 'cat_ban' ? [{ label: 'Xingamento', value: 'xingamento' }, { label: 'Mídia Inapropriada', value: 'midia' }, { label: 'Ameaça', value: 'ameaca' }, { label: 'Outro', value: 'outro_ban' }] :
                     tipo === 'cat_ap' ? [{ label: 'Vitória Errada', value: 'vit_errada_ap' }, { label: 'Pagamento Errado', value: 'pag_errado' }, { label: 'Desrespeito', value: 'outro_ap' }] :
                     [{ label: 'Vitória Errada', value: 'vit_errada_simu' }, { label: 'Favoritismo', value: 'favoritismo' }, { label: 'Desrespeito', value: 'outro_simu' }];

        const menuOcorrido = new ActionRowBuilder().addComponents(new StringSelectMenuBuilder().setCustomId(`ocorrido_${tipo}`).setPlaceholder('Qual foi o ocorrido?').addOptions(opcoes));
        await canal.send({ content: `${i.user} | <@&${ID_STAFF}>`, embeds: [embedTkt], components: [menuOcorrido] });
        await i.update({ content: `✅ Ticket criado: ${canal}`, components: [], ephemeral: true });
    }

    // --- FORMULÁRIO (MODAL) ---
    if (i.isStringSelectMenu() && i.customId.startsWith('ocorrido_')) {
        const modal = new ModalBuilder().setCustomId('modal_detalhes').setTitle('DETALHES DO OCORRIDO');
        const qmInput = new TextInputBuilder().setCustomId('quem').setLabel("QUEM FOI?").setPlaceholder(i.customId.includes('ap') || i.customId.includes('simu') ? "Ex: @picles" : "Ex: @batata").setStyle(TextInputStyle.Short).setRequired(true);
        const descInput = new TextInputBuilder().setCustomId('relato').setLabel("EXPLIQUE O OCORRIDO").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(qmInput), new ActionRowBuilder().addComponents(descInput));
        return await i.showModal(modal);
    }

    // --- RECEBER FORMULÁRIO E LOGS ---
    if (i.type === InteractionType.ModalSubmit && i.customId === 'modal_detalhes') {
        const quem = i.fields.getTextInputValue('quem');
        const relato = i.fields.getTextInputValue('relato');

        const embedLog = new EmbedBuilder()
            .setTitle('📝 RELATÓRIO DE DENÚNCIA')
            .addFields({ name: '👤 Acusado:', value: quem, inline: true }, { name: '👤 Denunciador:', value: `<@${i.user.id}>`, inline: true }, { name: '📝 Relato:', value: relato })
            .setColor('#f1c40f').setFooter({ text: '📩 Levaremos a situação para equipe...' });

        const btnStaff = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`falar_${i.user.id}`).setLabel('FALAR COM DENUNCIADOR').setEmoji('💬').setStyle(ButtonStyle.Primary));
        
        const logChannel = i.guild.channels.cache.get(CANAL_LOGS_DENUNCIA);
        if (logChannel) await logChannel.send({ embeds: [embedLog], components: [btnStaff] });

        const btnFechar = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar_tkt').setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger));
        await i.reply({ embeds: [embedLog], components: [btnFechar] });
    }

    // --- ABRIR TÓPICO PRIVADO (NOS LOGS) ---
    if (i.isButton() && i.customId.startsWith('falar_')) {
        const denunciadorId = i.customId.split('_')[1];
        const thread = await i.channel.threads.create({ name: `conversa-${denunciadorId}`, type: ChannelType.PrivateThread });
        await thread.members.add(i.user.id); await thread.members.add(denunciadorId);
        await thread.send({ content: `👋 <@${denunciadorId}>, a Staff <@${i.user.id}> iniciou esta conversa privada sobre sua denúncia.` });
        await i.reply({ content: `✅ Tópico criado: ${thread}`, ephemeral: true });
    }

    // --- FECHAR TICKET ---
    if (i.isButton() && i.customId === 'fechar_tkt') {
        await i.reply('🔒 Deletando em 5 segundos...');
        setTimeout(() => i.channel.delete().catch(() => {}), 5000);
    }
});

client.login(TOKEN);
