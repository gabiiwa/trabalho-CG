import * as THREE from '../../build/three.module.js';
import Stats from '../../build/jsm/libs/stats.module.js';
import { OBJLoader } from '../../build/jsm/loaders/OBJLoader.js';
import { MTLLoader } from '../build/jsm/loaders/MTLLoader.js';
import { TrackballControls } from '../../build/jsm/controls/TrackballControls.js';
import {
    InfoBox,
    SecondaryBox,
    initRenderer,
    initCamera,
    getMaxSize,
    degreesToRadians,
    onWindowResize,
    initDefaultBasicLight,
    createGroundPlaneWired,
} from "../../libs/util/util.js";
import KeyboardState from '../../libs/util/KeyboardState.js';
import aviao from './aviao.js';
import ambiente from './ambiente.js';
import checkpoints, {
    checaColisao,
    caminho,
    registraTimestampInspecao,
    ocultaInfoBox
} from './caminho_checkpoint.js';
import criarCidade from './cidade.js';

////////// Coisas da cena, como renderização, camera/////////////////////

var stats = new Stats();          // To show FPS information
var scene = new THREE.Scene();    // Create main scene
var scene1 = new THREE.Scene();
var renderer = initRenderer();    // View function in util/utils
renderer.autoClear = false;
var instrucaoAtiva = true;
var somAviaoStatus = false;
var modoInspecaoAtivo = false;
var cameraPilotoAtiva = false;
var keyboard = new KeyboardState();
var clock = new THREE.Clock();
var camera = initCamera(new THREE.Vector3(5.0, 5.0, 30.0)); // Init camera in this position
camera.far = 10000;
camera.updateProjectionMatrix();

// Configura o Trackball da câmera de inspeção
var trackballControls = new TrackballControls(camera, renderer.domElement);
trackballControls.enabled = false;

// Adiciona html que exibe as estatísticas na página
document.body.appendChild(stats.dom);

// Adiciona luz ambiente à cena principal
const lightHem = new THREE.HemisphereLight('rgb(255, 255, 255)', 'rgb(47, 79, 79)', 0.5);
scene.add(lightHem);
scene.background = new THREE.Color('rgb(207, 192, 192)');

// Adiciona luz ambiente à cena que contém a skybox
const lightSb = new THREE.PointLight('rgb(255, 255, 255)', 2.0);
lightSb.position.set(0.0, -1200.0, 0.0);
scene1.add(lightSb);

// Spotlight que acompanha a câmera de inspeção
const spotLight = new THREE.SpotLight(0xffffff);
camera.add(spotLight);
scene.add(camera);
spotLight.visible = false;

//////////// Sol ////////////////

// Posição relativa da luz ao avião
var lightHolderPosition = new THREE.Vector3(500.0, 1000.0, 0.0);
// Vector que guarda a posição da luz em relação ao mundo
var lightPosition = new THREE.Vector3(0, 3, 0);
// Cor da luz
var lightColor = "rgb(255,255,255)";

//Luz Direcional
var dirLight = new THREE.DirectionalLight(lightColor);
var dirLightHolder = new THREE.Object3D();

function setDirectionalLighting(position) {
    dirLight.position.copy(position);
    dirLight.shadow.mapSize.width = 1024;
    dirLight.shadow.mapSize.height = 1024;
    dirLight.castShadow = true;

    var d = 20; // metade do tamanho da aresta do quadrado que delimita a sombra da câmera
    dirLight.shadow.camera.near = 1;
    dirLight.shadow.camera.far = 1500;
    dirLight.shadow.camera.left = -d;
    dirLight.shadow.camera.right = d;
    dirLight.shadow.camera.top = d;
    dirLight.shadow.camera.bottom = -d;
    dirLight.visible = true;
    dirLight.intensity = 0.5;
    dirLight.decay = 1;
    dirLight.penumbra = 0.1;

    //Helpers de visualização da luz e da camera de projeção de sombras
    // const helper = new THREE.DirectionalLightHelper(dirLight, 5);
    // const helper2 = new THREE.CameraHelper(dirLight.shadow.camera);
    // scene.add(helper);
    // scene.add(helper2);

    // Copia a posição do vetor e adiciona a luz no holder
    dirLight.position.copy(lightHolderPosition);
    dirLightHolder.add(dirLight);

    return dirLightHolder;
}

scene.add(setDirectionalLighting(lightPosition));

function updateLightPosition() {
    dirLightHolder.position.copy(lightPosition);
}

//////////////// Luz com sombra estática para as arvores e montanhas ////////////////////

function criaLuzDirecionalComSombraEstatica(scene_ref, x, z, d_shadow) {
    // Cria luz
    var light = new THREE.DirectionalLight(lightColor);
    var lightHolder = new THREE.Object3D();
    var ligthTargetHolder = new THREE.Object3D();

    //Configura a luz
    light.target = ligthTargetHolder;
    light.shadow.mapSize.width = 1024;
    light.shadow.mapSize.height = 1024;
    light.castShadow = true;
    light.shadow.autoUpdate = false; // Garante que a luz vai renderizar por demanda
    light.shadow.needsUpdate = true; // quando essa variável estiver true. Depois do render essa variavel vai a false.
    light.shadow.camera.near = 1;
    light.shadow.camera.far = 1800;
    light.shadow.camera.left = -d_shadow;
    light.shadow.camera.right = d_shadow;
    light.shadow.camera.top = d_shadow;
    light.shadow.camera.bottom = -d_shadow;
    light.visible = true;
    light.intensity = 0.01;
    light.decay = 1;
    light.penumbra = 0.1;

    // Posição da luz em relação ao holder dela
    light.position.copy(lightHolderPosition);
    lightHolder.add(light);
    scene_ref.add(lightHolder);

    // Posição do holder
    lightHolder.position.set(x, 0, z);

    //Helpers de visualização da luz e da camera de projeção de sombras
    // const helper = new THREE.DirectionalLightHelper(light, 5);
    // const helper2 = new THREE.CameraHelper(light.shadow.camera);
    // scene_ref.add(helper);
    // scene_ref.add(helper2);

    // Cria o holder pra onde a luz vai estar apontada
    ligthTargetHolder.position.set(
        x,
        1.0,
        z
    );

    scene_ref.add(ligthTargetHolder);

    return light;
}

// Cria as 4 luzes, uma em cada quadrante do plano pra projeção das 
// sombras estáticas
let dimensaoLuz = 1000;
let raioLuz = dimensaoLuz / 2.0;
var light1 = criaLuzDirecionalComSombraEstatica(scene, -raioLuz, raioLuz, raioLuz);
var light2 = criaLuzDirecionalComSombraEstatica(scene, -raioLuz, -raioLuz, raioLuz);
var light3 = criaLuzDirecionalComSombraEstatica(scene, raioLuz, -raioLuz, raioLuz);
var light4 = criaLuzDirecionalComSombraEstatica(scene, raioLuz, raioLuz, raioLuz);

/////////// Câmera simulação //////////////////

var cameraSimula = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 25000);
cameraSimula.lookAt(0, 0, 0);
cameraSimula.position.set(0.0, 0.0, -0.1);

//Adiciona a câmera ao holder dela
var cameraSimulaHolder = new THREE.Object3D();
cameraSimulaHolder.add(cameraSimula);
cameraSimulaHolder.rotateY(degreesToRadians(180));
cameraSimulaHolder.rotateX(degreesToRadians(-15));

//Adiciona o holder a um outro holder pra poder posicionar a câmera atrás do avião
var cameraSimulaHolderHolder = new THREE.Object3D();
cameraSimulaHolderHolder.add(cameraSimulaHolder);
scene.add(cameraSimulaHolderHolder);

/////////// Câmera do Piloto //////////////////

var cameraPiloto = new THREE.PerspectiveCamera(60, window.innerWidth / window.innerHeight, 1, 25000);
cameraPiloto.lookAt(0, 0, 0.1);
cameraPiloto.position.set(0.0, 1.3, -1.8);

////////////// Objetos /////////////////////

// Cria as variaveis que vão conter os elementos e inicializa com um objeto vazio
var plane = new THREE.Object3D();
var planoLim = new THREE.Object3D();
var skybox = new THREE.Object3D();
var cidade = new THREE.Object3D();
let ambienteHolder = new THREE.Object3D();
let checkpointHolder = new THREE.Object3D();
let caminho_curva = new THREE.Object3D();
var aviaoHolder = new THREE.Object3D();
var eixo_helice = new THREE.Object3D();

function carregaObjetos() {
    // Chão principal
    var planeGeometry = new THREE.PlaneGeometry(2000, 2000, 1, 1);
    planeGeometry.translate(0.0, 0.0, 0.0);
    var planeMaterial = new THREE.MeshLambertMaterial({
        color: 'rgb(89, 179, 0)',
        map: texturasCarregadas['grama_periferia.jpg']
    });
    planeMaterial.map.repeat.set(150, 150);
    planeMaterial.map.wrapS = THREE.RepeatWrapping;
    planeMaterial.map.wrapT = THREE.RepeatWrapping;
    plane = new THREE.Mesh(planeGeometry, planeMaterial);
    plane.rotateX(degreesToRadians(-90));
    plane.receiveShadow = true;
    scene.add(plane);

    // Plano limite da skybox
    var planeGeom = new THREE.PlaneGeometry(18000, 18000, 1, 1);
    var planeMat = new THREE.MeshLambertMaterial({
        color: 'rgb(21, 79, 6)',
    });
    planoLim = new THREE.Mesh(planeGeom, planeMat);
    planoLim.rotateX(degreesToRadians(-90));
    planeGeom.translate(0.0, 0.0, -0.1);
    planoLim.receiveShadow = true;
    scene.add(planoLim);

    // Geometria da skybox, que é adicionada a uma cena separada com iluminação própria
    var geomSkybox = new THREE.BoxGeometry(18000, 18000, 18000);

    geomSkybox.translate(0.0, -1200.0, 0.0);

    var matSkybox = [
        new THREE.MeshLambertMaterial({ map: texturasCarregadas["Daylight_Box_Right.png"], side: THREE.BackSide }), // à direita do avião
        new THREE.MeshLambertMaterial({ map: texturasCarregadas["Daylight_Box_Left.png"], side: THREE.BackSide }), // à esquerda do avião
        new THREE.MeshLambertMaterial({ map: texturasCarregadas["Daylight_Box_Top.png"], side: THREE.BackSide }), // acima
        new THREE.MeshLambertMaterial({ map: texturasCarregadas["Daylight_Box_Bottom.png"], side: THREE.BackSide }), // abaixo
        new THREE.MeshLambertMaterial({ map: texturasCarregadas["Daylight_Box_Front.png"], side: THREE.BackSide }), // na frente do avião
        new THREE.MeshLambertMaterial({ map: texturasCarregadas["Daylight_Box_Back.png"], side: THREE.BackSide }) // atrás do avião
    ];

    skybox = new THREE.Mesh(geomSkybox, matSkybox);
    scene1.add(skybox);

    //Adiciona a cidade
    cidade = criarCidade(texturasCarregadas, objetoExterno);
    scene.add(cidade);

    // Adiciona os meshes do ambiente (arvores e montanhas)
    ambienteHolder = ambiente(texturasCarregadas);
    scene.add(ambienteHolder);

    // Adiciona os checkpoints
    checkpointHolder = checkpoints(texturasCarregadas);
    scene.add(checkpointHolder);

    //Caminho
    caminho_curva = caminho(texturasCarregadas);
    scene.add(caminho_curva);

    // Avião
    var aviaoObj = aviao(texturasCarregadas);
    aviaoHolder = aviaoObj.aviaoHolder;
    eixo_helice = aviaoObj.eixo_helice;
    scene.add(aviaoHolder);
    aviaoHolder.position.set(-684.0, 1.0, -480.0);//0,20.0,0

    // Adiciona a câmera com a visão do piloto do avião
    aviaoHolder.add(cameraPiloto);

    // Define que a luz direcional vai iluminar o avião
    dirLight.target = aviaoHolder;

    // Atualiza as sombras estáticas
    light1.shadow.needsUpdate = true;
    light2.shadow.needsUpdate = true;
    light3.shadow.needsUpdate = true;
    light4.shadow.needsUpdate = true;

    // Mantem o avião invisível no primeiro render pra não
    // gerar uma sombra fixa no chão
    aviaoHolder.visible = false;
}

//////////// Avião ////////////////

var posicaoAviaoSalva = new THREE.Vector3();
var rotacaoAviaoSalva = new THREE.Vector3();
var rotacaoAviao = new THREE.Vector3();

// Define a posição da câmera em relação ao centróide do avião
var cameraPosition = new THREE.Vector3(0.0, 8.0, -20.0);

///////////// Instruções /////////////

var controls = new InfoBox();
controls.add("Controles:");
controls.addParagraph();
controls.add("Modos:");
controls.add("* Espaço: alterna entre inspeção/simulação");
controls.add("* C: alterna entre simulação/cockpit");
controls.addParagraph();
controls.add("Movimentação:");
controls.add("* Seta para cima: desce o avião");
controls.add("* Seta para baixo: sobe o avião");
controls.add("* Seta para a esquerda: vira o avião para a esquerda");
controls.add("* Seta para a direita: vira o avião para a direita");
controls.add("* Q: acelera o avião");
controls.add("* A: desacelera o avião");
controls.addParagraph();
controls.add("* Enter: mostra/oculta caminho");
controls.addParagraph();
controls.add("* H: mostra/oculta instruções");
controls.show();

///////////// Modos de câmera /////////////////////

function alternaModo() {

    // Alterna entre modo inspeção e simulação
    if (keyboard.down("space")) {
        modoInspecaoAtivo = !modoInspecaoAtivo;

        // Esconde os planos no modo inspeção
        plane.visible = modoInspecaoAtivo === false;
        planoLim.visible = modoInspecaoAtivo === false;
        // Esconde caminho no modo de inspeção
        caminho_curva.visible = modoInspecaoAtivo === false;
        // Esconde os elementos do ambiente no modo de inspeção
        ambienteHolder.visible = modoInspecaoAtivo === false;
        // Esconde os checkpoints no modo de inspeção
        checkpointHolder.visible = modoInspecaoAtivo === false;

        // Deixa somente a luz spotlight visível no modo de inspeção
        spotLight.visible = modoInspecaoAtivo === true;
        lightHem.visible = modoInspecaoAtivo === false;
        dirLight.visible = modoInspecaoAtivo === false;
        light1.visible = modoInspecaoAtivo === false;
        light2.visible = modoInspecaoAtivo === false;
        light3.visible = modoInspecaoAtivo === false;
        light4.visible = modoInspecaoAtivo === false;
        skybox.visible = modoInspecaoAtivo === false;
        cidade.visible = modoInspecaoAtivo === false;

        // Esconde infobox do tempo
        ocultaInfoBox(modoInspecaoAtivo);

        // Registra timestamp de inspeção pra excluir o tempo em inspeção do timer
        registraTimestampInspecao();

        if (modoInspecaoAtivo) {
            trackballControls.enabled = true;
            sound.pause();

            // Salva o estado do som do avião antes da mudança de modo
            somAviaoStatus = aviaoSound.isPlaying;

            // Pausa o som do avião
            if (somAviaoStatus == true) {
                aviaoSound.pause();
            }

            // Aqui salva a posição
            posicaoAviaoSalva = aviaoHolder.position.clone();
            rotacaoAviaoSalva = rotacaoAviao.clone();

            // Aqui zera tudo pro modo inspeção
            aviaoHolder.position.set(0.0, 0.0, 0.0);
            aviaoHolder.rotation.set(0.0, 0.0, 0.0);
            rotacaoAviao.set(0, 0, 0);

        } else {
            trackballControls.enabled = false;
            sound.play();

            // Volta a tocar o som do avião (se ele estava sendo tocado antes de ir pro modo de inspeção)
            if (somAviaoStatus == true) {
                aviaoSound.play();
            }

            // Aqui restaura a posição salva
            aviaoHolder.position.set(posicaoAviaoSalva.x, posicaoAviaoSalva.y, posicaoAviaoSalva.z);
            //aviaoHolder.setRotation(rotacaoAviaoSalva.x, rotacaoAviaoSalva.y, rotacaoAviaoSalva.z);
            rotacaoAviao = rotacaoAviaoSalva.clone();
        }

    }

    // Alterna entre câmera de simulação para visão em terceira pessoa para
    // visão em primeira pessoa, da cabine do avião
    if (keyboard.down("C")) {
        cameraPilotoAtiva = !cameraPilotoAtiva;
    }

    // Posiciona o holder exterior da câmera junto ao avião
    cameraSimulaHolderHolder.position.set(
        aviaoHolder.position.x,
        aviaoHolder.position.y,
        aviaoHolder.position.z
    );

    // Posiciona o holder principal da câmera afastado da origen do holder exterior, pra quando
    // rodar o holder exterior. Isso dá um efeito de rotação na câmera de um pivô deslocado
    cameraSimulaHolder.position.set(
        cameraPosition.x,
        cameraPosition.y,
        cameraPosition.z
    );

    // Roda a câmera no pivô deslocado para manter ela atrás do avião
    cameraSimulaHolderHolder.rotation.y = rotacaoAviao.y;//+ degreesToRadians(180);

    // Desloca a luz no plano paralelo ao chão
    //dirLightHolder.rotation.y = rotacaoAviao.y;//+ degreesToRadians(180);

    lightPosition.set(
        aviaoHolder.position.x,
        aviaoHolder.position.y,
        aviaoHolder.position.z
    )
    updateLightPosition();
}

///////////////////// Movimentação /////////////////////

var delta = clock.getDelta();
var speedRot = THREE.Math.degToRad(45);
var speed = 0; // m/s     //50
var aceleracao = 10;
var velocidadeMaxima = 70; // m/s
var maxangle = degreesToRadians(45);

function movimentaAviao() {

    if (keyboard.pressed("up")) {
        rotacaoAviao.x += speedRot * delta;
    } else if (keyboard.pressed("down")) {
        rotacaoAviao.x -= speedRot * delta;
    } else {
        //volta o valor de x pra zero
        let rx = Math.round(rotacaoAviao.x * 100) / 100;
        if (rx > 0) {
            rotacaoAviao.x -= speedRot * delta * 0.5;
        } else if (rx < 0) {
            rotacaoAviao.x += speedRot * delta * 0.5;
        } else {
            rotacaoAviao.x = 0;
        }
    }

    // Testa se a rotação no eixo X saiu do limite + ou -, se saiu ele impede de rodar mais
    if (rotacaoAviao.x >= maxangle) {
        rotacaoAviao.x = maxangle;
    } else if (rotacaoAviao.x <= -maxangle) {
        rotacaoAviao.x = -maxangle;
    }


    if (keyboard.pressed("right")) {
        rotacaoAviao.z += speedRot * delta * 1.4;
    } else if (keyboard.pressed("left")) {
        rotacaoAviao.z -= speedRot * delta * 1.4;
    } else {
        //volta o valor de z pra zero
        let rz = Math.round(rotacaoAviao.z * 100) / 100;
        if (rz > 0) {
            rotacaoAviao.z -= speedRot * delta * 1.2;
        } else if (rz < 0) {
            rotacaoAviao.z += speedRot * delta * 1.2;
        } else {
            rotacaoAviao.z = 0;
        }
    }

    // Testa se a rotação no eixo z saiu do limite + ou -, se saiu ele impede de rodar mais
    if (rotacaoAviao.z >= maxangle) {
        rotacaoAviao.z = maxangle;
    } else if (rotacaoAviao.z <= -maxangle) {
        rotacaoAviao.z = -maxangle;
    }

    // A rotação no eixo Y proporcional ao quanto está rodando no eixo Z
    let c1 = (velocidadeMaxima / (Math.pow(velocidadeMaxima, 2) * 1.1)) * speed;
    let dy = rotacaoAviao.z * -c1 * delta;
    rotacaoAviao.y += dy;

    // Aumenta a velocidade do avião até um certo limite
    if (keyboard.pressed("Q")) {
        speed += aceleracao * delta;
        if (speed > velocidadeMaxima) {
            speed = velocidadeMaxima;
        }
    }

    // Diminui a velocidade do avião até um certo limite
    if (keyboard.pressed("A")) {
        speed -= aceleracao * delta;
        if (speed < 0) {
            speed = 0;
        }
    }

    // Toca ou pausa o som do avião
    if (speed > 0) {
        if (aviaoSound.isPlaying == false) {
            aviaoSound.play();
        }
    } else {
        aviaoSound.pause();
    }

    aplicaRotacao();

    // Aplica translação no avião
    aviaoHolder.translateZ(speed * delta);

    // Impede que o avião "entre" no chão
    if (aviaoHolder.position.y < 1.0) {
        aviaoHolder.position.set(
            aviaoHolder.position.x,
            1.0,
            aviaoHolder.position.z
        )
    }

    // Roda a hélice
    eixo_helice.rotateY(0.5 * speed * delta);

    //Caminho visualização
    if (keyboard.down("enter")) {
        liga_Caminho = !liga_Caminho;
        caminho_curva.visible = liga_Caminho;
    };
}

function aplicaRotacao() {
    // https://threejs.org/docs/#api/en/math/Euler
    // Converte as rotações pro sistema do Three.js na ordem apropriada
    var euler = new THREE.Euler(
        rotacaoAviao.x,
        rotacaoAviao.y,
        rotacaoAviao.z,
        'YXZ'
    );

    // https://threejs.org/docs/#api/en/core/Object3D.setRotationFromEuler
    // Aplica no holder do avião
    aviaoHolder.quaternion.setFromEuler(euler);
}


///////////// Tela de loading das texturas ////////////////////

const texturas = [
    // Texturas da cidade e periferia
    "asfalto.jpg",
    "conc02.jpg",
    "grama.jpg",
    "grama_periferia.jpg",
    "Grass0018_1_350.jpg",
    "chao_pedra.jpg",
    "fazendinha_feliz.jpg",
    "lago.png",
    "concreto.jpg",
    "container_roof.jpg",
    "apartment_block5.png",
    "building_factory.png",
    "brick01.jpg",
    "building_l2.png",
    "predio1_teste.jpg",
    "predio1_caixinha_paredes.jpg",
    "predio2_cano.jpg",
    "predio2_sem_cano.jpg",
    "predio2_caixinha_porta.jpg",
    "predio2_caixinha.jpg",
    "predio2_triangulo_frente.jpg",
    "predio2_triangulo_lados.jpg",
    "predio2_roof.jpg",
    "predio6_caixinha_maior.jpg",
    "predio6_caixinha_menor.jpg",
    "predio6_maior.jpg",
    "predio6_menor.jpg",
    "predio3_andar1.jpg",
    "predio3_andar2.jpg",
    "predio3_lado1.jpg",
    "predio3_lado2.jpg",
    "moita1.png",
    "areia.png",
    "mancha.png",
    // Texturas do avião
    "opcao3.jpg",
    "wings.jpg",
    "simbolo.png",
    // Texturas da skybox
    "Daylight_Box_Back.png",
    "Daylight_Box_Bottom.png",
    "Daylight_Box_Front.png",
    "Daylight_Box_Left.png",
    "Daylight_Box_Right.png",
    "Daylight_Box_Top.png"
]

const manager = new THREE.LoadingManager();
manager.onStart = function (url, itemsLoaded, itemsTotal) {
    setProgresso(0);
};

manager.onLoad = function () {
    mostraBotaoContinuar();

    // Carrega os objetos que dependem das texturas
    carregaObjetos();

    // Roda o avião em direção a cidade
    rotacaoAviao.y = degreesToRadians(30);
    aplicaRotacao();

    // Com a câmera de simulação visualizando toda a cidade, executa um pré compile
    // das texturas
    renderer.compile(scene, cameraSimula);

    // Inicia o renderizador
    render();
};

manager.onProgress = function (url, itemsLoaded, itemsTotal) {
    // O total de itens carregados é o conteudo do array de texturas
    // mais os 4 audios e o objeto externo
    setProgresso(itemsLoaded / (texturas.length + 5));
};

function setProgresso(progresso) {
    if (progresso > 1) {
        progresso = 1;
    }
    if (progresso < 0) {
        progresso = 0;
    }
    let barraLoading = document.getElementById("barraLoading");
    let txtLoading = document.getElementById("txtLoading");
    barraLoading.style.width = `${200 * progresso}px`;
    txtLoading.innerHTML = `Carregando ${Math.round(progresso * 100)}%`
}
function escondeTelaLoading() {
    let telaLoading = document.getElementById("telaLoading");
    telaLoading.style.display = 'none';

    // Depois de alguns ciclos de render e de carregar todas as texturas
    // volta a rotação do avião pra posição normal pra iniciar o jogo
    rotacaoAviao.y = degreesToRadians(0);
    aplicaRotacao();

    // Inicia a música
    sound.play();
}
function mostraBotaoContinuar() {
    let btnContinuar = document.getElementById("btnContinuar");
    let fundoLoading = document.getElementById("fundoLoading");
    let txtLoading = document.getElementById("txtLoading");
    btnContinuar.style.display = 'flex';
    fundoLoading.style.display = 'none';
    txtLoading.style.display = 'none';

    btnContinuar.addEventListener("click", function () {
        escondeTelaLoading();
    });
}
manager.onError = function (url) {
    console.error('There was an error loading ' + url);
};

const loader = new THREE.TextureLoader(manager);

// Dicionário que contem as texturas carregadas
var texturasCarregadas = {};

// Carrega as texturas no dicionário
for (let i = 0; i < texturas.length; i++) {
    let caminho_textura = "assets\\textures\\" + texturas[i];
    loader.load(caminho_textura, function (object) {
        //Faz um dicionario com as texturas carregadas
        texturasCarregadas[texturas[i]] = object;
    });
}

///////////// Áudio /////////////

var listener = new THREE.AudioListener();
camera.add(listener);
cameraSimula.add(listener);
cameraPiloto.add(listener);

// create a global audio source
const sound = new THREE.Audio(listener);

// Música ambiente
var audioLoader = new THREE.AudioLoader(manager);
audioLoader.load('./assets/sounds/musica.mp3', function (buffer) {
    sound.setBuffer(buffer);
    sound.setLoop(true);
    sound.setVolume(0.4);
    //sound.play();
    //sound.autoplay = true;
});

// Som do avião
const aviaoSound = new THREE.Audio(listener);
audioLoader.load('./assets/sounds/aviao.ogg', function (buffer) {
    aviaoSound.setBuffer(buffer);
    aviaoSound.setLoop(true);
    aviaoSound.setVolume(0.2);
});

// Som dos checkpoints
const checkpointSound = new THREE.Audio(listener);
audioLoader.load('./assets/sounds/checkpoint.wav', function (buffer) {
    checkpointSound.setBuffer(buffer);
    checkpointSound.setVolume(0.5);
});

// Som de fim de percurso
const fimPercursoSound = new THREE.Audio(listener);
audioLoader.load('./assets/sounds/final_percurso.wav', function (buffer) {
    fimPercursoSound.setBuffer(buffer);
    fimPercursoSound.setVolume(1.0);
});

// Função para tocar o som dos checkpoints ou o som de fim de percurso
export default function tocaSomCheckpoint(final) {
    if (final) {
        checkpointSound.pause();
        fimPercursoSound.play();
    } else {
        checkpointSound.play();
    }
}

///////////// Objeto externo //////////////


var objetoExterno = null;

function loadOBJFile(modelPath, modelName, desiredScale, angle, visibility) {
    var currentModel = modelName;
    //var manager = new THREE.LoadingManager( );

    var mtlLoader = new MTLLoader(manager);
    mtlLoader.setPath(modelPath);
    mtlLoader.load(modelName + '.mtl', function (materials) {
        materials.preload();

        var objLoader = new OBJLoader(manager);
        objLoader.setMaterials(materials);
        objLoader.setPath(modelPath);
        objLoader.load(modelName + ".obj", function (obj) {
            obj.visible = visibility;
            obj.name = modelName;
            // Set 'castShadow' property for each children of the group
            obj.traverse(function (child) {
                child.castShadow = true;
            });

            obj.traverse(function (node) {
                if (node.material) node.material.side = THREE.DoubleSide;
            });


            var obj = normalizeAndRescale(obj, desiredScale);
            var obj = fixPosition(obj);
            obj.rotateY(degreesToRadians(angle));

            obj.translateX(-85.0);
            //obj.translateY(1.0);
            obj.translateY(0.1);
            obj.translateZ(100.0);

            objetoExterno = obj;

        }, onProgress, onError);
    });
}

function onError(erro) {
    console.error(erro);
};

function onProgress(xhr, model) {
    if (xhr.lengthComputable) {
        var percentComplete = xhr.loaded / xhr.total * 100;
    }
}

// Normalize scale and multiple by the newScale
function normalizeAndRescale(obj, newScale) {
    var scale = getMaxSize(obj); // Available in 'utils.js'
    obj.scale.set(newScale * (1.0 / scale),
        newScale * (1.0 / scale),
        newScale * (1.0 / scale));
    return obj;
}

function fixPosition(obj) {
    // Fix position of the object over the ground plane
    var box = new THREE.Box3().setFromObject(obj);
    if (box.min.y > 0)
        obj.translateY(-box.min.y);
    else
        obj.translateY(-1 * box.min.y);
    return obj;
}

loadOBJFile('./assets/objects/', 'Decoration 14', 30.0, 0, true);

//////////// Listen window size changes e render///////////////////

window.addEventListener('resize', function () {
    if (modoInspecaoAtivo) {
        onWindowResize(camera, renderer);
    } else {
        onWindowResize(cameraSimula, renderer);
    }
}, false);


var liga_Caminho = true;

function render() {
    stats.update(); // Update FPS
    keyboard.update();

    trackballControls.update();
    requestAnimationFrame(render);
    delta = clock.getDelta();

    // Só movimenta o avião se estiver no modo simulação
    if (!modoInspecaoAtivo) {
        movimentaAviao();
        checaColisao(aviaoHolder);
    }

    alternaModo();
    stats.begin();

    if (modoInspecaoAtivo) {
        renderer.render(scene, camera) // Render scene
    } else if (cameraPilotoAtiva) {
        renderer.clear();
        renderer.render(scene, cameraPiloto) // Render scene
        renderer.render(scene1, cameraPiloto) // Skybox
    } else {
        renderer.clear();
        renderer.render(scene, cameraSimula) // Render scene cameraSimula
        renderer.render(scene1, cameraSimula) // Skybox
    }

    stats.end();

    // Coloca o avião como visível no segundo render da cena
    // já que no primeiro render ele faz as sombras estáticas
    // Isso é feito pra não ter uma sombra estática do avião presa
    // no chão.
    if (!aviaoHolder.visible) {
        aviaoHolder.visible = true;
    }

    // Visualização das instruções
    if (keyboard.down("H")) {
        instrucaoAtiva = !instrucaoAtiva;
        var infobox = document.getElementById("InfoxBox");
        if (instrucaoAtiva) {
            infobox.style.display = 'block';
        } else {
            infobox.style.display = 'none';
        }
    }
}