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
const CANAL_SETUP_FIXO = '1476773027516518470'; // Onde fica o painel
const CANAL_LOGS_EQUIPE = '1476775424540282934'; // Recebimento da Staff

// Registro automático do Slash Command /setupsz
client.once('ready', async () => {
    const commands = [{
        name: 'setupsz',
        description: 'Posta o painel fixo de tickets (Tópicos Privados)',
        default_member_permissions: PermissionFlagsBits.Administrator.toString()
    }];
    const rest = new REST({ version: '10' }).setToken(TOKEN);
    try {
        await rest.put(Routes.applicationCommands(client.user.id), { body: commands });
        console.log(`🚀 Ticket-SZ Online: ${client.user.tag}`);
    } catch (e) { console.error(e); }
});

client.on('interactionCreate', async (i) => {
    // --- 1. PAINEL FIXO (/setupsz) ---
    if (i.isChatInputCommand() && i.commandName === 'setupsz') {
        if (i.channel.id !== CANAL_SETUP_FIXO) return i.reply({ content: `❌ Use em <#${CANAL_SETUP_FIXO}>`, ephemeral: true });

        const embed = new EmbedBuilder()
            .setTitle('🎫 CENTRAL DE ATENDIMENTO - ALPHA')
            .setDescription('Precisa de ajuda ou quer denunciar algo?\nUse o menu ou o botão abaixo para iniciar seu atendimento privado.')
            .setColor('#2b2d31');

        const btn = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId('abrir_tkt').setLabel('ABRIR TICKET').setEmoji('📩').setStyle(ButtonStyle.Success)
        );

        const menu = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId('menu_cat').setPlaceholder('Escolha a categoria rápida...')
                .addOptions([
                    { label: 'BAN / KICK', value: 'cat_ban', emoji: '🔨' },
                    { label: 'FALHA EM AP', value: 'cat_ap', emoji: '💰' },
                    { label: 'FALHA EM SIMU', value: 'cat_simu', emoji: '🏆' }
                ])
        );

        await i.reply({ content: '✅ Painel postado!', ephemeral: true });
        await i.channel.send({ embeds: [embed], components: [btn, menu] });
    }

    // --- 2. RESPOSTA PRIVADA (EPHEMERAL) + ABERTURA DE TÓPICO ---
    if ((i.isButton() && i.customId === 'abrir_tkt') || (i.isStringSelectMenu() && i.customId === 'menu_cat')) {
        const tipo = i.values?.[0] || 'geral';
        
        // Criação da Thread Privada no canal do painel
        const thread = await i.guild.channels.cache.get(CANAL_SETUP_FIXO).threads.create({
            name: `sz-${tipo.replace('cat_', '')}-${i.user.username}`,
            type: ChannelType.PrivateThread,
            autoArchiveDuration: 60
        });

        await thread.members.add(i.user.id);

        const embedTkt = new EmbedBuilder()
            .setTitle(`📩 ATENDIMENTO: ${tipo.replace('cat_', '').toUpperCase()}`)
            .setDescription(`Olá ${i.user}, selecione o **OCORRIDO** abaixo para detalhar sua denúncia.\n\n📩 *Levaremos a situação para equipe, pode ser que entremos em contato.*`)
            .setColor('#5865F2');

        const menuOcorrido = new ActionRowBuilder().addComponents(
            new StringSelectMenuBuilder().setCustomId(`ocorrido_${tipo}`).setPlaceholder('Qual foi o ocorrido?')
                .addOptions(tipo === 'cat_ban' ? [{ label: 'Xingamento', value: 'xing' }, { label: 'Mídia', value: 'midia' }, { label: 'Outro', value: 'outro' }] :
                            tipo === 'cat_ap' ? [{ label: 'Vitória Errada', value: 'vit_ap' }, { label: 'Pagamento', value: 'pag_ap' }, { label: 'Outro', value: 'outro' }] :
                            [{ label: 'Vitória Errada', value: 'vit_simu' }, { label: 'Favoritismo', value: 'fav' }, { label: 'Outro', value: 'outro' }])
        );

        await thread.send({ content: `<@${i.user.id}> | <@&${ID_STAFF}>`, embeds: [embedTkt], components: [menuOcorrido] });
        
        // Resposta que SÓ O USUÁRIO VÊ no canal do painel
        await i.reply({ content: `✅ Seu ticket foi aberto aqui: <#${thread.id}>`, ephemeral: true });
    }

    // --- 3. FORMULÁRIO (MODAL) ---
    if (i.isStringSelectMenu() && i.customId.startsWith('ocorrido_')) {
        const modal = new ModalBuilder().setCustomId('modal_sz').setTitle('DETALHES DO OCORRIDO');
        const qm = new TextInputBuilder().setCustomId('quem').setLabel("QUEM FOI?").setPlaceholder("Ex: @batata ou @picles").setStyle(TextInputStyle.Short).setRequired(true);
        const rel = new TextInputBuilder().setCustomId('relato').setLabel("EXPLIQUE O OCORRIDO").setStyle(TextInputStyle.Paragraph).setRequired(true);
        modal.addComponents(new ActionRowBuilder().addComponents(qm), new ActionRowBuilder().addComponents(rel));
        return await i.showModal(modal);
    }

    // --- 4. RECEBER MODAL E ENVIAR LOG PARA EQUIPE ---
    if (i.type === InteractionType.ModalSubmit && i.customId === 'modal_sz') {
        const quem = i.fields.getTextInputValue('quem');
        const relato = i.fields.getTextInputValue('relato');
        const modo = i.channel.name.split('-')[1].toUpperCase();

        const embedEquipe = new EmbedBuilder()
            .setTitle(`🚨 DENÚNCIA: ${modo}`)
            .addFields(
                { name: '👤 Denunciador:', value: `<@${i.user.id}>`, inline: true },
                { name: '👤 Acusado:', value: quem, inline: true },
                { name: '📝 Relato:', value: relato }
            ).setColor(modo === 'AP' ? '#ff0000' : '#f1c40f').setTimestamp();

        const btnEquipe = new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`fechar_${i.channel.id}`).setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger),
            new ButtonBuilder().setCustomId(`dm_${i.user.id}`).setLabel('AVISAR RESOLVIDO (DM)').setStyle(ButtonStyle.Success)
        );

        const logChan = i.guild.channels.cache.get(CANAL_LOGS_EQUIPE);
        if (logChan) await logChan.send({ embeds: [embedEquipe], components: [btnEquipe] });

        const btnFecharSimples = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('fechar_local').setLabel('FECHAR TICKET').setStyle(ButtonStyle.Danger));
        await i.reply({ content: '✅ Relato enviado para a equipe! Aguarde o retorno.', embeds: [embedEquipe], components: [btnFecharSimples] });
    }

    // --- 5. BOTÕES DE FECHAR E DM (LOGS E LOCAL) ---
    if (i.isButton()) {
        const parts = i.customId.split('_');
        
        // Fechar pelo canal de logs (Apaga Tópico + Apaga Mensagem de Log)
        if (i.customId.startsWith('fechar_')) {
            const threadAlvo = i.guild.channels.cache.get(parts[1]);
            if (threadAlvo) await threadAlvo.delete().catch(() => {});
            await i.message.delete().catch(() => {});
            await i.reply({ content: '✅ Ticket encerrado e log limpo!', ephemeral: true });
        }

        // Fechar pelo botão dentro do próprio tópico
        if (i.customId === 'fechar_local') {
            await i.reply('🔒 Fechando em 5 segundos...');
            setTimeout(() => i.channel.delete().catch(() => {}), 5000);
        }

        // Enviar DM de resolvido
        if (i.customId.startsWith('dm_')) {
            try {
                const user = await client.users.fetch(parts[1]);
                await user.send(`✅ Olá! Sua denúncia no **Alpha** foi resolvida pela Staff. Obrigado!`);
                await i.reply({ content: '✅ DM enviada!', ephemeral: true });
            } catch (e) { await i.reply({ content: '❌ DM fechada!', ephemeral: true }); }
        }
    }
});

client.login(TOKEN);
