const { 
    Client, GatewayIntentBits, EmbedBuilder, ActionRowBuilder, 
    ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits, 
    StringSelectMenuBuilder, ModalBuilder, TextInputBuilder, 
    TextInputStyle, InteractionType, REST, Routes 
} = require('discord.js');

const client = new Client({ 
    intents: [
        GatewayIntentBits.Guilds, 
        GatewayIntentBits.GuildMessages, 
        GatewayIntentBits.MessageContent,
        GatewayIntentBits.GuildMembers
    ] 
});

// --- CONFIGURAÇÕES ---
const TOKEN = process.env.DISCORD_TOKEN;
const ID_STAFF = '1452822605773148312';
const CANAL_SETUP_TOPICOS = '1476773027516518470';
const CANAL_LOGS_EQUIPE = '1476775424540282934';

// Registro automático do Slash Command /setupsz
client.once('ready', async () => {
    console.log(`🚀 Ticket-SZ Online: ${client.user.tag}`);
    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel de tickets (Tópicos Privados)',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log('✅ Comando /setupsz registrado com sucesso!');
    } catch (error) { console.error('Erro ao registrar comando:', error); }
});

client.on('interactionCreate', async (interaction) => {
    // --- 1. COMANDO /SETUPSZ ---
    if (interaction.isChatInputCommand() && interaction.commandName === 'setupsz') {
        if (interaction.channel.id !== CANAL_SETUP_TOPICOS) {
            return interaction.reply({ content: `❌ Use este comando em <#${CANAL_SETUP_TOPICOS}>`, ephemeral: true });
        }

        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - SZ')
            .setDescription('Precisa de suporte ou denunciar algo?\n\nUtilize o **Menu** ou o **Botão** abaixo para abrir um **Tópico Privado** de atendimento.')
            .setColor('#2b2d31')
            .setThumbnail(interaction.guild.iconURL())
            .setFooter({ text: 'Alpha System • Atendimento via Threads' });

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('abrir_tkt_btn').setLabel('ABRIR TICKET').setEmoji('📩').setStyle(ButtonStyle.Success)
        );

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_cat_sz').setPlaceholder('Escolha uma categoria rápida...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'ban', emoji: '🔨', description: 'Denunciar infrações graves.' },
                    { label: 'FALHA EM AP', value: 'ap', emoji: '💰', description: 'Problemas em apostados (URGENTE).' },
                    { label: 'FALHA EM SIMU', value: 'simu', emoji: '🏆', description: 'Erros em simuladores ou x1.' }
                ])
        );

        await interaction.reply({ content: '✅ Painel de tickets enviado!', ephemeral: true });
        await interaction.channel.send({ embeds: [embed], components: [btn, menu] });
    }

    // --- 2. CRIAÇÃO DO TÓPICO PRIVADO ---
    if ((interaction.isButton() && interaction.customId === 'abrir_tkt_btn') || (interaction.isStringSelectMenu() && interaction.customId === 'menu_cat_sz')) {
        const categoria = interaction.values?.[0] || 'geral';
        
        // Criação da Thread Privada no canal de setup
        const thread = await interaction.channel.threads.create({
            name: `sz-${categoria}-${interaction.user.username}`,
            autoArchiveDuration: 60,
            type: ChannelType.PrivateThread,
            reason: `Ticket aberto por ${interaction.user.tag}`
        });

        await thread.members.add(interaction.user.id);

        const embedBoasVindas = new EmbedBuilder()
            .setTitle(`📩 ATENDIMENTO: ${categoria.toUpperCase()}`)
            .setDescription(`Olá ${interaction.user}, para prosseguir, selecione o **OCORRIDO** no menu abaixo.\n\n📩 *Levaremos a situação para equipe, pode ser que entremos em contato.*`)
            .setColor('#5865F2');

        let opcoesOcorrido = [];
        if (categoria === 'ban') {
            opcoesOcorrido = [
                { label: 'Xingamento', value: 'xingamento' },
                { label: 'Mídia Inapropriada', value: 'midia' },
                { label: 'Ameaça', value: 'ameaca' },
                { label: 'Outro', value: 'outro_ban' }
            ];
        } else if (categoria === 'ap') {
            opcoesOcorrido = [
                { label: 'Vitória Errada', value: 'vit_ap' },
                { label: 'Pagamento Pendente', value: 'pag_ap' },
                { label: 'Outro / Desrespeito', value: 'outro_ap' }
            ];
        } else {
            opcoesOcorrido = [
                { label: 'Vitória Errada', value: 'vit_simu' },
                { label: 'Favoritismo', value: 'fav_simu' },
                { label: 'Outro / Desrespeito', value: 'outro_simu' }
            ];
        }

        const menuOcorrido = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`ocorrido_${categoria}`).setPlaceholder('Selecione o ocorrido exato...')
                .addOptions(opcoesOcorrido)
        );

        await thread.send({ content: `<@${interaction.user.id}> | <@&${ID_STAFF}>`, embeds: [embedBoasVindas], components: [menuOcorrido] });
        
        const resposta = `✅ Seu atendimento foi iniciado em: <#${thread.id}>`;
        if (interaction.replied) await interaction.followUp({ content: resposta, ephemeral: true });
        else await interaction.reply({ content: resposta, ephemeral: true });
    }

    // --- 3. FORMULÁRIO (MODAL) ---
    if (interaction.isStringSelectMenu() && interaction.customId.startsWith('ocorrido_')) {
        const modal = new ModalBuilder().setCustomId('modal_sz_final').setTitle('DETALHES DA DENÚNCIA');
        
        const quemInput = new TextInputBuilder()
            .setCustomId('quem_acusado')
            .setLabel("QUEM FOI?")
            .setPlaceholder("Ex: @batata ou @picles")
            .setStyle(TextInputStyle.Short).setRequired(true);

        const relatoInput = new TextInputBuilder()
            .setCustomId('relato_sz')
            .setLabel("EXPLIQUE O OCORRIDO")
            .setPlaceholder("Descreva o que aconteceu em detalhes...")
            .setStyle(TextInputStyle.Paragraph).setRequired(true);

        modal.addComponents(
            new ActionRowBuilder().addComponents(quemInput),
            new ActionRowBuilder().addComponents(relatoInput)
        );

        return await interaction.showModal(modal);
    }

    // --- 4. RECEBIMENTO DO FORMULÁRIO E LOG NA EQUIPE ---
    if (interaction.type === InteractionType.ModalSubmit && interaction.customId === 'modal_sz_final') {
        const acusado = interaction.fields.getTextInputValue('quem_acusado');
        const relato = interaction.fields.getTextInputValue('relato_sz');
        const modoTkt = interaction.channel.name.split('-')[1].toUpperCase();

        const embedLogEquipe = new EmbedBuilder()
            .setTitle(`🚨 NOVA DENÚNCIA | MODO: ${modoTkt}`)
            .addFields(
                { name: '👤 Denunciador:', value: `<@${interaction.user.id}>`, inline: true },
                { name: '👤 Acusado:', value: acusado, inline: true },
                { name: '📝 Relato:', value: relato }
            )
            .setColor(modoTkt.includes('AP') ? '#ff0000' : '#f1c40f')
            .setTimestamp();

        // Botões para a Staff no canal de Logs
        const btnEquipe = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fechar_tkt_${interaction.channel.id}`).setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger).setEmoji('🔒'),
            new ButtonBuilder().setCustomId(`dm_ok_${interaction.user.id}`).setLabel('AVISAR RESOLVIDO').setStyle(ButtonStyle.Success).setEmoji('📩')
        );

        const canalLogs = interaction.guild.channels.cache.get(CANAL_LOGS_EQUIPE);
        if (canalLogs) await canalLogs.send({ embeds: [embedLogEquipe], components: [btnEquipe] });

        await interaction.reply({ 
            content: '✅ **Relato enviado com sucesso!** A Staff analisará as informações e entrará em contato se necessário.', 
            embeds: [embedLogEquipe] 
        });
    }

    // --- 5. AÇÕES DA STAFF (FECHAR E DM) ---
    if (interaction.isButton()) {
        const customId = interaction.customId;

        // FECHAR TICKET (Apaga Tópico + Apaga Mensagem de Log)
        if (customId.startsWith('fechar_tkt_')) {
            const threadId = customId.split('_')[2];
            const threadAlvo = interaction.guild.channels.cache.get(threadId);

            if (threadAlvo) await threadAlvo.delete().catch(() => {});
            await interaction.message.delete().catch(() => {});
            await interaction.reply({ content: '✅ Tópico deletado e log removido.', ephemeral: true });
        }

        // AVISAR RESOLVIDO VIA DM
        if (customId.startsWith('dm_ok_')) {
            const playerID = customId.split('_')[2];
            try {
                const usuario = await client.users.fetch(playerID);
                await usuario.send(`✅ Olá! Sua denúncia/falha relatada no **Alpha** foi analisada e o problema já foi resolvido. Obrigado por avisar!`);
                await interaction.reply({ content: `✅ DM enviada para <@${playerID}>!`, ephemeral: true });
            } catch (e) {
                await interaction.reply({ content: '❌ Não consegui enviar DM (usuário com DM fechada).', ephemeral: true });
            }
        }
    }
});

client.login(TOKEN);
